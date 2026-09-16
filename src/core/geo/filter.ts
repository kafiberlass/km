/**
 * Фильтр сырых GPS-точек. Чистый редьюсер: (state, point) -> (state, verdict).
 *
 * Именно здесь ловятся артефакты, на которых такие приложения и ломаются:
 * «дрожание» точки у окна дома, телепорт после выхода из метро, поездка
 * на транспорте вместо прогулки.
 *
 * Гоняется в vitest на записанных GPX-треках без эмулятора.
 */

import { haversineMeters, type LngLat } from './mercator';

export interface GeoPoint extends LngLat {
  /** Точность в метрах (радиус 68%), как её отдаёт ОС. */
  accuracy: number;
  /** Unix ms. */
  timestamp: number;
  speed?: number | null;
  heading?: number | null;
  altitude?: number | null;
  isMock?: boolean;
}

export interface FilterConfig {
  /** Точки хуже этого значения выбрасываются целиком. */
  maxAccuracyM: number;
  /** Ближе этого расстояния точка считается дрожанием и не двигает трек. */
  minDistanceM: number;
  /** Быстрее — это уже не пешком: телепорт или транспорт. */
  maxSpeedMps: number;
  /** Разрыв во времени, после которого трек рвётся (потеря сигнала). */
  maxGapMs: number;
  /** Игнорировать точки от поддельного провайдера. */
  rejectMock: boolean;
}

export const DEFAULT_FILTER: FilterConfig = {
  maxAccuracyM: 50,
  minDistanceM: 5,
  // 8 м/с ~ 29 км/ч: быстрый бег проходит, велосипед и машина — нет.
  maxSpeedMps: 8,
  maxGapMs: 2 * 60_000,
  rejectMock: true,
};

export type Verdict =
  | { kind: 'accepted'; distanceM: number; speedMps: number; gapMs: number }
  /** Точка начинает новый сегмент: первая в сессии или после разрыва. */
  | { kind: 'segment-start' }
  | { kind: 'rejected'; reason: RejectReason; detail?: number };

export type RejectReason = 'accuracy' | 'mock' | 'jitter' | 'speed' | 'backwards';

export interface FilterState {
  last: GeoPoint | null;
}

export const initialFilterState: FilterState = { last: null };

export function filterStep(
  state: FilterState,
  point: GeoPoint,
  config: FilterConfig = DEFAULT_FILTER,
): { state: FilterState; verdict: Verdict } {
  if (config.rejectMock && point.isMock) {
    return { state, verdict: { kind: 'rejected', reason: 'mock' } };
  }
  if (!Number.isFinite(point.accuracy) || point.accuracy > config.maxAccuracyM) {
    return {
      state,
      verdict: { kind: 'rejected', reason: 'accuracy', detail: point.accuracy },
    };
  }

  const last = state.last;
  if (!last) {
    return { state: { last: point }, verdict: { kind: 'segment-start' } };
  }

  const gapMs = point.timestamp - last.timestamp;
  if (gapMs < 0) {
    // Точки приходят не по порядку — такое бывает при выгрузке батча из натива.
    return { state, verdict: { kind: 'rejected', reason: 'backwards', detail: gapMs } };
  }
  if (gapMs > config.maxGapMs) {
    return { state: { last: point }, verdict: { kind: 'segment-start' } };
  }

  const distanceM = haversineMeters(last, point);
  if (distanceM < config.minDistanceM) {
    // Точку не принимаем, но и `last` не двигаем: иначе дрожание будет
    // накапливаться мелкими шажками и рисовать несуществующий путь.
    return { state, verdict: { kind: 'rejected', reason: 'jitter', detail: distanceM } };
  }

  const speedMps = gapMs > 0 ? distanceM / (gapMs / 1000) : Infinity;
  if (speedMps > config.maxSpeedMps) {
    // Сам факт разрыва фиксируем: следующая точка начнёт новый сегмент,
    // чтобы не рисовать прямую линию через полгорода.
    return {
      state: { last: null },
      verdict: { kind: 'rejected', reason: 'speed', detail: speedMps },
    };
  }

  return {
    state: { last: point },
    verdict: { kind: 'accepted', distanceM, speedMps, gapMs },
  };
}

export interface FilterRun {
  /** Сегменты принятых точек; новый сегмент = разрыв трека. */
  segments: GeoPoint[][];
  distanceM: number;
  durationMs: number;
  rejected: Record<RejectReason, number>;
}

/** Прогон целого трека — для тестов и для импорта GPX. */
export function filterTrack(points: GeoPoint[], config: FilterConfig = DEFAULT_FILTER): FilterRun {
  let state = initialFilterState;
  const segments: GeoPoint[][] = [];
  let current: GeoPoint[] = [];
  let distanceM = 0;
  let durationMs = 0;
  const rejected: Record<RejectReason, number> = {
    accuracy: 0,
    mock: 0,
    jitter: 0,
    speed: 0,
    backwards: 0,
  };

  for (const point of points) {
    const result = filterStep(state, point, config);
    state = result.state;

    switch (result.verdict.kind) {
      case 'segment-start':
        if (current.length > 1) segments.push(current);
        current = [point];
        break;
      case 'accepted':
        current.push(point);
        distanceM += result.verdict.distanceM;
        durationMs += result.verdict.gapMs;
        break;
      case 'rejected':
        rejected[result.verdict.reason] += 1;
        if (result.verdict.reason === 'speed' && current.length > 1) {
          segments.push(current);
          current = [];
        }
        break;
    }
  }

  if (current.length > 1) segments.push(current);
  return { segments, distanceM, durationMs, rejected };
}
