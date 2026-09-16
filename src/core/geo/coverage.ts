/**
 * Учётный слой тумана: какие H3-ячейки открыты и сколько это процентов.
 *
 * Важно: это ОТДЕЛЬНАЯ структура от того, что рисуется на экране.
 * Картинку рисует Skia по геометрии трека (features/fog), а здесь живёт
 * счётная модель — множество ячеек. Разделение даёт и красивую мягкую
 * границу тумана, и точный, проверяемый на сервере процент открытия.
 */

// Полифил обязан выполниться до загрузки h3-js: она при импорте делает
// new TextDecoder("utf-16le"), которого в React Native нет. Импорт стоит
// здесь, а не только в index.js, потому что порядок импортов внутри модуля —
// единственная гарантия, не зависящая ни от точки входа, ни от роутера.
import '@/core/polyfills/textDecoder';

import {
  UNITS,
  cellToLatLng,
  cellToParent,
  getHexagonAreaAvg,
  getHexagonEdgeLengthAvg,
  gridDisk,
  latLngToCell,
  polygonToCells,
} from 'h3-js';

import { haversineMeters, type LngLat } from './mercator';

/** ~2150 м² на ячейку, ребро ~25 м. Достаточная точность для «тропы» шириной 100 м. */
export const CELL_RES = 11;

/** Родитель для батчей синка и выборки по вьюпорту: ~5 км² на ячейку. */
export const PARENT_RES = 7;

/** Радиус раскрытия тумана вокруг позиции, настоящие метры по земле. */
export const REVEAL_RADIUS_M = 50;

const EDGE_M = getHexagonEdgeLengthAvg(CELL_RES, UNITS.m);
/** Расстояние между центрами соседних ячеек. */
const CELL_PITCH_M = EDGE_M * Math.sqrt(3);

export type Cell = string;

/**
 * Ячейки, попадающие в круг радиуса `radiusM` вокруг точки.
 *
 * gridDisk даёт шестиугольную «розетку», поэтому по краям её приходится
 * подрезать по настоящему расстоянию — иначе открытая зона будет заметно
 * больше нарисованной.
 */
export function cellsAround(
  p: LngLat,
  radiusM: number = REVEAL_RADIUS_M,
  res: number = CELL_RES,
): Cell[] {
  const center = latLngToCell(p.lat, p.lng, res);
  const k = Math.max(0, Math.ceil(radiusM / CELL_PITCH_M));
  if (k === 0) return [center];

  const out: Cell[] = [];
  for (const cell of gridDisk(center, k)) {
    const [lat, lng] = cellToLatLng(cell);
    if (haversineMeters(p, { lat, lng }) <= radiusM + EDGE_M) {
      out.push(cell);
    }
  }
  return out;
}

/**
 * Ячейки вдоль отрезка пути. Между GPS-точками бывает 10-20 метров, и если
 * считать раскрытие только по точкам, в тропе остаются дырки. Поэтому отрезок
 * досэмплируется с шагом в половину ячейки.
 */
export function cellsAlongSegment(
  a: LngLat,
  b: LngLat,
  radiusM: number = REVEAL_RADIUS_M,
  res: number = CELL_RES,
): Cell[] {
  const distance = haversineMeters(a, b);
  const steps = Math.max(1, Math.ceil(distance / (CELL_PITCH_M / 2)));
  const seen = new Set<Cell>();

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p: LngLat = {
      lat: a.lat + (b.lat - a.lat) * t,
      lng: a.lng + (b.lng - a.lng) * t,
    };
    for (const cell of cellsAround(p, radiusM, res)) seen.add(cell);
  }
  return [...seen];
}

export function parentOf(cell: Cell, res: number = PARENT_RES): Cell {
  return cellToParent(cell, res);
}

/** Группировка по родителю — формат батча для будущего синка с сервером. */
export function groupByParent(cells: Iterable<Cell>): Map<Cell, Cell[]> {
  const out = new Map<Cell, Cell[]>();
  for (const cell of cells) {
    const parent = parentOf(cell);
    const bucket = out.get(parent);
    if (bucket) bucket.push(cell);
    else out.set(parent, [cell]);
  }
  return out;
}

/** Покрытие региона (например, границ города) в ячейках — знаменатель для процента. */
export function regionCells(polygonLngLat: number[][], res: number = CELL_RES): Cell[] {
  // polygonToCells ждёт [lat, lng]; GeoJSON-порядок включается третьим аргументом.
  return polygonToCells([polygonLngLat], res, true);
}

export interface CoverageStats {
  explored: number;
  total: number;
  ratio: number;
  exploredAreaM2: number;
}

export function coverageStats(exploredInRegion: number, regionTotal: number): CoverageStats {
  const areaPerCell = getHexagonAreaAvg(CELL_RES, UNITS.m2);
  return {
    explored: exploredInRegion,
    total: regionTotal,
    ratio: regionTotal > 0 ? exploredInRegion / regionTotal : 0,
    exploredAreaM2: exploredInRegion * areaPerCell,
  };
}

export function formatPercent(ratio: number): string {
  if (ratio > 0 && ratio < 0.01) return '<1%';
  return `${Math.floor(ratio * 100)}%`;
}
