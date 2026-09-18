/**
 * Восстановление счётчиков прогулки из уже записанных точек.
 *
 * После перезапуска приложение знает только идентификатор сессии — всё
 * остальное (сколько пройдено, где обрывался трек, какая точка была
 * последней) приходится собирать заново из базы. Расчёт чистый,
 * поэтому проверяется тестами, а не прогулкой по улице.
 */

import { haversineMeters } from '@/core/geo/mercator';
import type { GeoPoint } from '@/core/geo/filter';

export interface StoredPoint {
  segment: number;
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

export interface RestoredWalk {
  distanceM: number;
  /** Номер последнего сегмента: продолжать надо его, а не начинать новый. */
  segmentIndex: number;
  /** Точки последнего сегмента — из них дорисовывается тропа на карте. */
  liveSegment: { lat: number; lng: number }[];
  /** Последняя точка для фильтра: с ней сравнивается первая после пробуждения. */
  last: GeoPoint | null;
  points: number;
}

export function restoreWalk(stored: readonly StoredPoint[]): RestoredWalk {
  if (stored.length === 0) {
    return { distanceM: 0, segmentIndex: 0, liveSegment: [], last: null, points: 0 };
  }

  let distanceM = 0;
  for (let i = 1; i < stored.length; i += 1) {
    const previous = stored[i - 1]!;
    const current = stored[i]!;
    // Через разрыв трека расстояние не считается: сегменты рвутся именно
    // там, где путь неизвестен, и соединять их прямой — приписывать метры.
    if (current.segment !== previous.segment) continue;
    distanceM += haversineMeters(previous, current);
  }

  const lastPoint = stored[stored.length - 1]!;
  const segmentIndex = lastPoint.segment;

  return {
    distanceM,
    segmentIndex,
    liveSegment: stored
      .filter((point) => point.segment === segmentIndex)
      .map((point) => ({ lat: point.lat, lng: point.lng })),
    last: {
      lat: lastPoint.lat,
      lng: lastPoint.lng,
      accuracy: lastPoint.accuracy,
      timestamp: lastPoint.timestamp,
    },
    points: stored.length,
  };
}
