/**
 * Уместны ли демонстрационные места.
 *
 * Отдельным файлом от seed.ts — не ради красоты. seed.ts читает базу,
 * а база тянет нативный op-sqlite, которого в Node нет: тест такого
 * модуля падает целиком, ещё до первой проверки. Правило же должно
 * проверяться тестами, поэтому живёт здесь, без базы и без экранов.
 */

import { haversineMeters, type LngLat } from '@/core/geo/mercator';

/** Чистые пруды, Москва — там же начинается демо-трек в assets/fixtures. */
export const DEMO_CENTER: [number, number] = [37.6425, 55.7625];

/**
 * С какого расстояния демо-места считаются чужими.
 *
 * Пятьдесят километров — это вся Москва с областью: живущему в Химках
 * показать Чистые пруды не абсурд, он туда ездит. Казань в семистах
 * километрах, и вопрос «почему мне показывают Москву» там законен.
 */
export const DEMO_FAR_M = 50_000;

/** Уместны ли демо-места человеку, чей дом вот здесь. */
export function demoPlacesFit(origin: LngLat | null): boolean {
  if (!origin) return true;

  const center = { lng: DEMO_CENTER[0], lat: DEMO_CENTER[1] };
  return haversineMeters(origin, center) <= DEMO_FAR_M;
}
