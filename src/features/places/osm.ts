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
export type PlaceKind = 'cafe' | 'park' | 'viewpoint' | 'landmark';

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
  { tag: 'tourism', value: 'artwork', kind: 'viewpoint', label: 'Арт-объект', radiusM: 50, xpReward: 70 },

  // Достопримечательности: то, ради чего едут через весь город. Радиус
  // больше — у кремля или монастыря «дойти» начинается от ограды,
  // а не от точки, которой его отметили на карте.
  { tag: 'tourism', value: 'attraction', kind: 'landmark', label: 'Достопримечательность', radiusM: 150, xpReward: 120 },
  { tag: 'tourism', value: 'museum', kind: 'landmark', label: 'Музей', radiusM: 90, xpReward: 100 },
  { tag: 'historic', value: 'monument', kind: 'landmark', label: 'Памятник', radiusM: 70, xpReward: 90 },
  { tag: 'historic', value: 'memorial', kind: 'landmark', label: 'Мемориал', radiusM: 70, xpReward: 80 },
  { tag: 'historic', value: 'castle', kind: 'landmark', label: 'Крепость', radiusM: 200, xpReward: 150 },
  { tag: 'historic', value: 'fort', kind: 'landmark', label: 'Крепость', radiusM: 200, xpReward: 150 },
  { tag: 'historic', value: 'ruins', kind: 'landmark', label: 'Руины', radiusM: 120, xpReward: 100 },
  { tag: 'historic', value: 'building', kind: 'landmark', label: 'Историческое здание', radiusM: 90, xpReward: 90 },
  { tag: 'amenity', value: 'place_of_worship', kind: 'landmark', label: 'Храм', radiusM: 100, xpReward: 100 },
  { tag: 'amenity', value: 'theatre', kind: 'landmark', label: 'Театр', radiusM: 90, xpReward: 100 },
];

/**
 * Теги, которым мало быть собой: нужна ещё отметка в Викиданных.
 *
 * Церквей и «исторических зданий» в любом городе сотни, и половина —
 * рядовая застройка. Отметка в Викиданных означает, что объект кому-то
 * показался достойным отдельной статьи, — это и есть разница между
 * достопримечательностью и просто домом.
 */
const NEEDS_WIKIDATA = new Set(['place_of_worship', 'building']);

/** Сколько мест максимум оставляем: экран со списком в двести строк бесполезен. */
export const MAX_PLACES = 80;

/** Сколько из них достопримечательностей — большинство: за ними и ходят. */
export const LANDMARK_QUOTA = 50;

/**
 * Докуда поиск считается «вокруг дома».
 *
 * Дальше этой черты кафе и скверы перестают спрашиваться: за пятнадцать
 * километров никто не пойдёт за кофе, а вот в кремль — поедет. Заодно это
 * бережёт общественный сервер: кафе в большом городе тысячи, и запрос по
 * всей агломерации он просто не отдаст.
 */
export const LOCAL_RADIUS_M = 5000;

export function buildOverpassQuery(center: LngLat, radiusM: number): string {
  const around = `around:${Math.round(radiusM)},${center.lat.toFixed(5)},${center.lng.toFixed(5)}`;
  const rules = radiusM > LOCAL_RADIUS_M ? RULES.filter((rule) => rule.kind === 'landmark') : RULES;

  // way и node вместе: парк в OSM — это контур (way), а кафе — точка (node).
  // `out center` возвращает для контуров их середину, иначе координат не будет.
  const parts = rules.flatMap((rule) => {
    const extra = NEEDS_WIKIDATA.has(rule.value) ? '["wikidata"]' : '';
    return [
      `node["${rule.tag}"="${rule.value}"]${extra}(${around});`,
      `way["${rule.tag}"="${rule.value}"]${extra}(${around});`,
    ];
  });

  return `[out:json][timeout:50];(${parts.join('')});out center ${MAX_PLACES * 4};`;
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

    // Рядовой дом или церковь без отметки в Викиданных — не достопримечательность.
    if (NEEDS_WIKIDATA.has(rule.value) && !tags.wikidata) continue;

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

  // Достопримечательности идут первыми независимо от расстояния: ради
  // кремля человек проедет через город, ради ближайшей кофейни — нет.
  // Без этого при большом радиусе список забивался бы кафе у дома,
  // а всё интересное не влезало.
  const landmarks = found.filter((place) => place.type === 'landmark');
  const rest = found.filter((place) => place.type !== 'landmark');
  const picked = [...landmarks.slice(0, LANDMARK_QUOTA), ...rest].slice(0, MAX_PLACES);

  return picked.map(({ distanceM: _distanceM, ...place }) => place);
}
