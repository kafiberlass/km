/**
 * Открытие мест: до какого можно дотянуться из этой точки.
 *
 * Чистая функция, потому что правило простое, но ошибиться в нём легко:
 * радиус у каждого места свой (парк большой, смотровая маленькая),
 * и «дошёл» считается по нему, а не по общему числу.
 */

import { haversineMeters, type LngLat } from '@/core/geo/mercator';

export interface DiscoverablePlace extends LngLat {
  id: string;
  radiusM: number;
  title: string;
  xpReward: number;
}

/**
 * Места, до которых человек дошёл этой точкой.
 *
 * Возвращает список, а не первое попавшееся: в парке рядом с кофейней
 * открываются оба, и терять второе только потому, что оно в списке ниже,
 * неправильно.
 */
export function reachedPlaces<T extends DiscoverablePlace>(
  places: readonly T[],
  point: LngLat,
): T[] {
  return places.filter((place) => haversineMeters(place, point) <= place.radiusM);
}
