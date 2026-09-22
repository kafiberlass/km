/**
 * Отправка открытых мест друзьям.
 *
 * Приложение умело показывать чужие визиты с самого появления друзей,
 * но свои не отправляло никогда: код только читал таблицу. Раздел
 * «где был друг» был пуст у всех и остался бы пустым навсегда.
 *
 * Уезжает ровно три вещи: название места, его вид и его координаты.
 * Не маршрут, которым человек шёл, и не время в пути — только точка,
 * до которой дошёл, и когда это случилось.
 */

import type { LngLat } from '@/core/geo/mercator';

import { createFriendsProvider } from './provider';
import { visitTypeOf } from './visitType';

export function publishVisit(
  origin: LngLat,
  place: { title: string; type: string; lat: number; lng: number },
  visitedAt: number = Date.now(),
): void {
  const provider = createFriendsProvider(origin);
  if (!provider.publishVisit) return;

  void provider
    .publishVisit({
      title: place.title,
      type: visitTypeOf(place.type),
      lat: place.lat,
      lng: place.lng,
      visitedAt,
    })
    .catch((error: unknown) => {
      // Место уже открыто и засчитано; сеть — дело десятое.
      console.warn('[friends] визит не отправился', error);
    });
}
