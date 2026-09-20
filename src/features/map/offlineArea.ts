/**
 * Область карты, которую скачиваем на телефон.
 *
 * Чистая часть: границы вокруг дома и оценка объёма. Оценка нужна до
 * скачивания — человек должен понимать, что сейчас уедет в память
 * телефона, а не смотреть на полоску прогресса до неизвестного конца.
 */

import type { LngLat } from '@/core/geo/mercator';

/** Запад, юг, восток, север — порядок MapLibre. */
export type Bounds = [number, number, number, number];

/**
 * Масштабы, которые имеет смысл держать офлайн.
 *
 * Ниже 9 — область целиком, это единицы тайлов и стоит копейки.
 * Выше 16 объём растёт вчетверо на каждый шаг, а на прогулке разница
 * между «видно дома» и «видно подъезды» ни на что не влияет.
 */
export const OFFLINE_MIN_ZOOM = 9;
export const OFFLINE_MAX_ZOOM = 16;

const EARTH_RADIUS_KM = 6371;

export function boundsAround(center: LngLat, radiusKm: number): Bounds {
  const latDelta = (radiusKm / EARTH_RADIUS_KM) * (180 / Math.PI);

  // По долготе градус короче широтного — тем сильнее, чем ближе к полюсу.
  // Без косинуса коробка на широте Казани получилась бы вдвое уже нужного.
  const cos = Math.max(0.01, Math.cos((center.lat * Math.PI) / 180));
  const lngDelta = latDelta / cos;

  return [
    clampLng(center.lng - lngDelta),
    clampLat(center.lat - latDelta),
    clampLng(center.lng + lngDelta),
    clampLat(center.lat + latDelta),
  ];
}

function clampLat(value: number): number {
  return Math.max(-85, Math.min(85, value));
}

function clampLng(value: number): number {
  return Math.max(-180, Math.min(180, value));
}

/** Номер тайла по долготе на данном масштабе. */
function tileX(lng: number, zoom: number): number {
  return Math.floor(((lng + 180) / 360) * 2 ** zoom);
}

/** Номер тайла по широте: проекция Меркатора, отсюда логарифм. */
function tileY(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180;
  const y = (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2;
  return Math.floor(y * 2 ** zoom);
}

export function countTiles(
  bounds: Bounds,
  minZoom: number = OFFLINE_MIN_ZOOM,
  maxZoom: number = OFFLINE_MAX_ZOOM,
): number {
  const [west, south, east, north] = bounds;
  let total = 0;

  for (let zoom = minZoom; zoom <= maxZoom; zoom += 1) {
    const columns = tileX(east, zoom) - tileX(west, zoom) + 1;
    // Север даёт меньший номер строки: ось Y растёт вниз.
    const rows = tileY(south, zoom) - tileY(north, zoom) + 1;
    total += Math.max(1, columns) * Math.max(1, rows);
  }

  return total;
}

/**
 * Средний вес векторного тайла OpenMapTiles — около 25 КБ.
 *
 * Именно средний: в центре города тайл тяжелее, в поле почти пустой.
 * Оценка нужна, чтобы человек понимал порядок («десятки мегабайт»,
 * а не «гигабайты»), и точность тут ни к чему.
 */
const AVERAGE_TILE_BYTES = 25 * 1024;

export function estimateBytes(tiles: number): number {
  return tiles * AVERAGE_TILE_BYTES;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 100 * 1024 * 1024 ? 1 : 0)} МБ`;
}
