/**
 * Места из OpenStreetMap через Overpass API.
 *
 * Бесплатно и без ключа, данные под ODbL — атрибуция «© OpenStreetMap
 * contributors» уже стоит на карте. Google Places не берём сознательно:
 * дорого и запрещено кэшировать, а нам нужно именно кэшировать — места
 * должны находиться и без сети.
 *
 * Здесь только чистое: построение запроса и разбор ответа. Сеть — рядом,
 * в nearby.ts, чтобы разбор можно было проверить тестами, не выходя
 * в интернет и не завися от настроения чужого сервера.
 */

import { haversineMeters, type LngLat } from '@/core/geo/mercator';

/** Наши виды мест: под них нарисованы иконки и цвета на экране «Места». */
export type PlaceKind = 'cafe' | 'park' | 'viewpoint';

export interface OsmPlace {
  id: string;
  lat: number;
  lng: number;
  type: PlaceKind;
  title: string;
  subtitle: string | null;
  radiusM: number;
  xpReward: number;
}

/**
 * Что считаем местом и во что превращаем.
 *
 * Список намеренно короткий. Смысл места в игре — повод дойти, поэтому
 * сюда не попадают ни магазины, ни остановки: их слишком много, и открытие
 * каждого перестанет что-либо значить.
 */
const RULES: readonly {
  tag: string;
  value: string;
  kind: PlaceKind;
  label: string;
  radiusM: number;
  xpReward: number;
}[] = [
  { tag: 'leisure', value: 'park', kind: 'park', label: 'Парк', radiusM: 120, xpReward: 60 },
  { tag: 'leisure', value: 'garden', kind: 'park', label: 'Сад', radiusM: 100, xpReward: 60 },
  { tag: 'amenity', value: 'cafe', kind: 'cafe', label: 'Кафе', radiusM: 70, xpReward: 50 },
  { tag: 'tourism', value: 'viewpoint', kind: 'viewpoint', label: 'Смотровая', radiusM: 60, xpReward: 80 },
  { tag: 'tourism', value: 'museum', kind: 'viewpoint', label: 'Музей', radiusM: 70, xpReward: 80 },
  { tag: 'tourism', value: 'artwork', kind: 'viewpoint', label: 'Арт-объект', radiusM: 50, xpReward: 70 },
  { tag: 'historic', value: 'monument', kind: 'viewpoint', label: 'Памятник', radiusM: 60, xpReward: 70 },
  { tag: 'historic', value: 'memorial', kind: 'viewpoint', label: 'Мемориал', radiusM: 60, xpReward: 70 },
];

/** Сколько мест максимум оставляем: экран со списком в двести строк бесполезен. */
export const MAX_PLACES = 60;

export function buildOverpassQuery(center: LngLat, radiusM: number): string {
  const around = `around:${Math.round(radiusM)},${center.lat.toFixed(5)},${center.lng.toFixed(5)}`;

  // way и node вместе: парк в OSM — это контур (way), а кафе — точка (node).
  // `out center` возвращает для контуров их середину, иначе координат не будет.
  const parts = RULES.flatMap((rule) => [
    `node["${rule.tag}"="${rule.value}"](${around});`,
    `way["${rule.tag}"="${rule.value}"](${around});`,
  ]);

  return `[out:json][timeout:25];(${parts.join('')});out center ${MAX_PLACES * 4};`;
}

interface OverpassElement {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
}

function titleOf(tags: Record<string, string>): string | null {
  // Русское название предпочтительнее: приложение русскоязычное, а в OSM
  // у половины объектов имя на местном языке плюс name:ru рядом.
  const raw = tags['name:ru'] ?? tags.name ?? '';
  const title = raw.trim();
  return title.length > 0 ? title : null;
}

/**
 * Разбор ответа Overpass.
 *
 * Безымянные объекты выбрасываются: «Парк» без названия не повод никуда
 * идти, а в OSM таких контуров много. Дубли схлопываются по имени и месту:
 * один и тот же сквер часто описан и точкой, и контуром.
 */
export function parseOverpassPlaces(payload: unknown, center: LngLat): OsmPlace[] {
  const elements = (payload as { elements?: OverpassElement[] } | null)?.elements;
  if (!Array.isArray(elements)) return [];

  const seen = new Set<string>();
  const found: (OsmPlace & { distanceM: number })[] = [];

  for (const element of elements) {
    const tags = element.tags;
    if (!tags) continue;

    const rule = RULES.find((candidate) => tags[candidate.tag] === candidate.value);
    if (!rule) continue;

    const title = titleOf(tags);
    if (!title) continue;

    const lat = element.lat ?? element.center?.lat;
    const lng = element.lon ?? element.center?.lon;
    if (typeof lat !== 'number' || typeof lng !== 'number') continue;

    // Сотая доля градуса ~ километр по широте; для схлопывания дублей
    // берём четыре знака — это около десяти метров.
    const key = `${title.toLowerCase()}@${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    found.push({
      id: `osm-${element.type ?? 'node'}-${element.id ?? key}`,
      lat,
      lng,
      type: rule.kind,
      title,
      subtitle: rule.label,
      radiusM: rule.radiusM,
      xpReward: rule.xpReward,
      distanceM: haversineMeters(center, { lat, lng }),
    });
  }

  // Ближние важнее: до них дойдёшь, а до дальнего края радиуса — вряд ли.
  found.sort((a, b) => a.distanceM - b.distanceM);

  return found.slice(0, MAX_PLACES).map(({ distanceM: _distanceM, ...place }) => place);
}
