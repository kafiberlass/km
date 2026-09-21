/**
 * Построение геометрии тумана.
 *
 * Ключевое решение всего проекта: открытая зона — это НЕ полигон, который
 * надо считать буфером и объединять (turf.buffer + turf.union деградируют
 * в ноль через пару месяцев истории). Это обводка пути толстой линией
 * с круглыми концами, нарисованная в маску.
 *
 * Стоимость рисования зависит от числа точек в кадре, а не от размера
 * истории, и совпадает с тем, как открытая зона выглядит в макете:
 * коридор постоянной ширины со скруглениями и «блобы» вокруг мест.
 */

import { Skia, type SkPath } from '@shopify/react-native-skia';

import {
  createProjector,
  groundMetersToMercatorMeters,
  type LngLat,
  type Projector,
} from '@/core/geo/mercator';
import type { TrackSegment } from '@/core/db/repo';

import { DEFAULT_CRITTERS, pickCritters, type CritterSpot } from './critters';

export interface RevealCircle extends LngLat {
  radiusM: number;
}

export interface FogGeometry {
  /** Путь для маски: обводится толстой линией. */
  reveal: SkPath;
  /** Тот же путь для декоративной оранжевой линии поверх. */
  trail: SkPath;
  /** Рыбки и трава по кромке раскрытого. Сам выбор мест — в critters.ts. */
  critters: CritterSpot[];
  /** Радиус раскрытия в метрах Меркатора — им задаётся strokeWidth маски. */
  revealStrokeMerc: number;
  pointCount: number;
  segmentCount: number;
}

export interface BuildOptions {
  revealRadiusM: number;
  /** Круги вокруг найденных мест — «блобы» из макета. */
  circles?: RevealCircle[];
  /**
   * Прореживание: на низком зуме соседние точки всё равно ложатся в один
   * пиксель. Порог в метрах Меркатора, 0 — без прореживания.
   */
  simplifyMerc?: number;
}

export function buildFogGeometry(
  segments: TrackSegment[],
  origin: LngLat,
  options: BuildOptions,
): FogGeometry {
  const projector = createProjector(origin);
  const reveal = Skia.Path.Make();
  const trail = Skia.Path.Make();

  let pointCount = 0;
  let segmentCount = 0;

  // Спроецированные точки собираем попутно: по ним расставляется живность,
  // и второй проход по всей истории ради этого был бы расточительством.
  const walked: { x: number; y: number }[] = [];

  for (const segment of segments) {
    const added = appendSegment(
      reveal,
      trail,
      segment.points,
      projector,
      options.simplifyMerc ?? 0,
      walked,
    );
    if (added > 0) {
      pointCount += added;
      segmentCount += 1;
    }
  }

  // Места раскрываются кругом независимо от того, прошли рядом или нет.
  for (const circle of options.circles ?? []) {
    const p = projector.toLocal(circle);
    const r = groundMetersToMercatorMeters(circle.radiusM, circle.lat);
    reveal.addCircle(p.x, p.y, r);
  }

  const revealStrokeMerc = groundMetersToMercatorMeters(options.revealRadiusM, origin.lat) * 2;

  return {
    reveal,
    trail,
    // Разброс — от ширины коридора: живность держится его кромки,
    // а не расползается по всей карте.
    critters: pickCritters(walked, { ...DEFAULT_CRITTERS, spread: revealStrokeMerc * 0.42 }),
    revealStrokeMerc,
    pointCount,
    segmentCount,
  };
}

function appendSegment(
  reveal: SkPath,
  trail: SkPath,
  points: readonly LngLat[],
  projector: Projector,
  simplifyMerc: number,
  walked: { x: number; y: number }[],
): number {
  if (points.length === 0) return 0;

  let added = 0;
  let lastX = 0;
  let lastY = 0;

  for (const point of points) {
    const { x, y } = projector.toLocal(point);

    if (added === 0) {
      reveal.moveTo(x, y);
      trail.moveTo(x, y);
      walked.push({ x, y });
      lastX = x;
      lastY = y;
      added = 1;
      continue;
    }

    if (simplifyMerc > 0 && Math.hypot(x - lastX, y - lastY) < simplifyMerc) continue;

    reveal.lineTo(x, y);
    trail.lineTo(x, y);
    walked.push({ x, y });
    lastX = x;
    lastY = y;
    added += 1;
  }

  // Одиночная точка линией не обведётся — рисуем «пятно» явно.
  if (added === 1) {
    reveal.addCircle(lastX, lastY, 1);
  }

  return added;
}

/**
 * Дописать точку в уже построенную геометрию.
 *
 * Во время прогулки перестраивать весь путь нельзя: на длинной истории это
 * сотни миллисекунд на каждой новой точке. Дописываем инкрементально.
 */
export function appendPoint(
  geometry: FogGeometry,
  point: LngLat,
  origin: LngLat,
  startNewSegment: boolean,
): void {
  const projector = createProjector(origin);
  const { x, y } = projector.toLocal(point);

  if (startNewSegment) {
    geometry.reveal.moveTo(x, y);
    geometry.trail.moveTo(x, y);
  } else {
    geometry.reveal.lineTo(x, y);
    geometry.trail.lineTo(x, y);
  }
  geometry.pointCount += 1;
}
