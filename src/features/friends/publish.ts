/**
 * Когда отправлять свою позицию друзьям.
 *
 * Демо-провайдер тикает раз в три секунды — для сервера это неприемлемо:
 * такой темп сажает батарею за вечер и упирается в лимиты бесплатного
 * тарифа на ровном месте. Публикуем по одному из двух поводов: человек
 * заметно сместился или прошло достаточно времени с прошлой отправки.
 *
 * Функция чистая, поэтому правило проверяется тестами, а не наблюдением
 * за расходом батареи неделю спустя.
 */

import { haversineMeters, type LngLat } from '@/core/geo/mercator';

export const PUBLISH_MIN_DISTANCE_M = 100;
export const PUBLISH_MIN_INTERVAL_MS = 60_000;

export interface PublishState {
  point: LngLat;
  at: number;
}

export function shouldPublish(
  previous: PublishState | null,
  next: LngLat,
  now: number,
  minDistanceM: number = PUBLISH_MIN_DISTANCE_M,
  minIntervalMs: number = PUBLISH_MIN_INTERVAL_MS,
): boolean {
  // Первая точка уходит всегда: без неё друзья не увидят вообще ничего.
  if (!previous) return true;

  if (haversineMeters(previous.point, next) >= minDistanceM) return true;
  return now - previous.at >= minIntervalMs;
}

/**
 * Когда отправлять свою неделю.
 *
 * Число меняется медленно, и частить незачем: раз в три часа, плюс сразу
 * после прогулки — это ровно тот момент, когда только что пройденные
 * километры хочется показать.
 */
export const WEEK_PUBLISH_EVERY_MS = 3 * 60 * 60 * 1000;

export function shouldPublishWeek(lastAt: number | null, now: number, force: boolean): boolean {
  if (force) return true;
  if (lastAt == null) return true;
  return now - lastAt >= WEEK_PUBLISH_EVERY_MS;
}
