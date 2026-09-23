/**
 * Демо-места: четыре точки у Чистых прудов, там же, где идёт демо-трек.
 *
 * Нужны они ровно в одном случае — пока приложение не знает, где человек
 * живёт, и показать на карте нечего. Как только дом известен, места
 * приезжают настоящие, из OpenStreetMap.
 *
 * Отсюда правило ниже. Раньше демо-места исчезали только после удачного
 * поиска в OSM, а до тех пор человек в Казани разглядывал кофейню
 * на Мясницкой и пекарню на Покровке. Поиск же может не случиться долго:
 * не было связи, сервер карт был занят, приложение открыли в метро.
 * Поэтому теперь они уходят по самому факту «дом не в Москве», не
 * дожидаясь ничьего ответа.
 */

import { allPlaces, getProfile, removeDemoPlaces, upsertPlaces } from '@/core/db/repo';

import { DEMO_CENTER, demoPlacesFit } from './demo';

// Дальше по приложению DEMO_CENTER берут отсюда: точка переехала
// в отдельный файл ради тестов, а не ради переименований.
export { DEMO_CENTER, DEMO_FAR_M, demoPlacesFit } from './demo';

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

/**
 * Привести демо-места в соответствие с тем, где человек живёт.
 *
 * Вызывается при каждом запуске: дом появляется не сразу, а с первой
 * принятой точкой GPS, и момент «теперь мы знаем, где он» приложение
 * специально не ловит.
 */
export function syncDemoPlaces(): void {
  const profile = getProfile();
  const origin =
    profile.originLat != null && profile.originLng != null
      ? { lat: profile.originLat, lng: profile.originLng }
      : null;

  if (!demoPlacesFit(origin)) {
    removeDemoPlaces();
    return;
  }

  if (allPlaces().length > 0) return;
  upsertPlaces(DEMO_PLACES.map((p) => ({ ...p })));
}
