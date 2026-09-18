/**
 * Загрузка мест вокруг дома. Сеть и только сеть — разбор в osm.ts.
 *
 * Overpass — общественный бесплатный сервер, и вести себя с ним надо
 * соответственно: запрос делается по кнопке, а не сам по себе, результат
 * ложится в базу и дальше работает без сети.
 */

import type { LngLat } from '@/core/geo/mercator';

import { buildOverpassQuery, parseOverpassPlaces, type OsmPlace } from './osm';

/**
 * Серверы Overpass. Их несколько намеренно: основной бывает перегружен,
 * а зеркало отвечает. Оба общественные и бесплатные.
 */
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

/** Радиус поиска. Три километра — примерно час пешком в одну сторону. */
export const SEARCH_RADIUS_M = 3000;

/** Сервер общественный и иногда занят: ждать дольше полминуты бессмысленно. */
const TIMEOUT_MS = 30_000;

export type NearbyResult =
  | { status: 'ok'; places: OsmPlace[] }
  | { status: 'empty' }
  | { status: 'offline' }
  | { status: 'busy' }
  | { status: 'failed'; error: unknown };

export async function fetchNearbyPlaces(
  center: LngLat,
  radiusM: number = SEARCH_RADIUS_M,
): Promise<NearbyResult> {
  const query = buildOverpassQuery(center, radiusM);
  let lastResult: NearbyResult = { status: 'offline' };

  for (const endpoint of ENDPOINTS) {
    const result = await askOverpass(endpoint, query, center);
    // «Занят» и «нет связи» — повод спросить зеркало. Пустой ответ поводом
    // не является: значит, вокруг и правда ничего нет.
    if (result.status !== 'busy' && result.status !== 'offline') return result;
    lastResult = result;
  }

  return lastResult;
}

async function askOverpass(
  endpoint: string,
  query: string,
  center: LngLat,
): Promise<NearbyResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });

    // 429 и 504 у Overpass означают «сейчас занят, приходите позже»,
    // а не поломку: об этом человеку надо сказать другими словами.
    if (response.status === 429 || response.status === 504) return { status: 'busy' };
    if (!response.ok) return { status: 'failed', error: new Error(`HTTP ${response.status}`) };

    const places = parseOverpassPlaces(await response.json(), center);
    return places.length > 0 ? { status: 'ok', places } : { status: 'empty' };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return { status: 'busy' };
    console.warn(`[places] ${endpoint} не ответил`, error);
    return { status: 'offline' };
  } finally {
    clearTimeout(timer);
  }
}
