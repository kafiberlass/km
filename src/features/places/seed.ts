/**
 * Демо-места для скелета.
 *
 * В проде это будет импорт OSM-экстракта (Geofabrik, лицензия ODbL)
 * или Foursquare Open Source Places. Google Places сознательно не берём:
 * дорого и запрещено кэшировать, см. разбор расходов.
 */

import { allPlaces, upsertPlaces } from '@/core/db/repo';

/** Чистые пруды, Москва — там же начинается демо-трек в assets/fixtures. */
export const DEMO_CENTER: [number, number] = [37.6425, 55.7625];

const DEMO_PLACES = [
  {
    id: 'demo-cafe-1',
    lat: 55.7638,
    lng: 37.6398,
    type: 'cafe',
    title: 'Кофейня у прудов',
    subtitle: 'Открыто до 23:00',
    radiusM: 80,
    xpReward: 50,
  },
  {
    id: 'demo-park-1',
    lat: 55.7612,
    lng: 37.6452,
    type: 'park',
    title: 'Чистопрудный бульвар',
    subtitle: 'Аллея вдоль воды',
    radiusM: 120,
    xpReward: 60,
  },
  {
    id: 'demo-view-1',
    lat: 55.7659,
    lng: 37.6371,
    type: 'viewpoint',
    title: 'Крыша на Мясницкой',
    subtitle: 'Смотровая точка',
    radiusM: 60,
    xpReward: 80,
  },
  {
    id: 'demo-cafe-2',
    lat: 55.7591,
    lng: 37.6489,
    type: 'cafe',
    title: 'Пекарня на Покровке',
    subtitle: 'Круассаны с 8:00',
    radiusM: 70,
    xpReward: 50,
  },
] as const;

export function seedDemoPlaces(): void {
  if (allPlaces().length > 0) return;
  upsertPlaces(DEMO_PLACES.map((p) => ({ ...p })));
}
