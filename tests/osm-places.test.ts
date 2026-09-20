import { describe, expect, it } from 'vitest';

import {
  LOCAL_RADIUS_M,
  MAX_PLACES,
  buildOverpassQuery,
  parseOverpassPlaces,
} from '@/features/places/osm';

const CENTER = { lat: 55.7963, lng: 49.1088 };

describe('запрос в Overpass', () => {
  it('содержит радиус, координаты и оба вида объектов', () => {
    const query = buildOverpassQuery(CENTER, 3000);

    expect(query).toContain('around:3000,55.79630,49.10880');
    expect(query).toContain('node["amenity"="cafe"]');
    expect(query).toContain('way["leisure"="park"]');
    // Без `out center` у контуров не будет координат вовсе.
    expect(query).toContain('out center');
  });

  it('спрашивает достопримечательности, а не только кафе и парки', () => {
    const query = buildOverpassQuery(CENTER, 3000);

    expect(query).toContain('node["tourism"="attraction"]');
    expect(query).toContain('way["historic"="castle"]');
    expect(query).toContain('node["amenity"="theatre"]');
  });

  it('храмы и старые здания спрашиваются только с отметкой в Викиданных', () => {
    const query = buildOverpassQuery(CENTER, 3000);

    expect(query).toContain('node["amenity"="place_of_worship"]["wikidata"]');
    expect(query).toContain('way["historic"="building"]["wikidata"]');
  });

  it('на дальнем радиусе спрашиваются только достопримечательности', () => {
    const query = buildOverpassQuery(CENTER, LOCAL_RADIUS_M * 5);

    // За двадцать пять километров за кофе не ходят, а в кремль ездят.
    expect(query).not.toContain('"cafe"');
    expect(query).not.toContain('"park"');
    expect(query).toContain('node["tourism"="attraction"]');
  });
});

describe('разбор ответа', () => {
  const payload = {
    elements: [
      {
        type: 'node',
        id: 1,
        lat: 55.7965,
        lon: 49.109,
        tags: { amenity: 'cafe', name: 'Кофейня' },
      },
      {
        type: 'way',
        id: 2,
        center: { lat: 55.8, lon: 49.11 },
        tags: { leisure: 'park', 'name:ru': 'Парк Горького', name: 'Gorky Park' },
      },
      // Безымянный сквер: повода дойти не даёт.
      { type: 'way', id: 3, center: { lat: 55.79, lon: 49.1 }, tags: { leisure: 'park' } },
      // Магазин: не наш вид места.
      { type: 'node', id: 4, lat: 55.797, lon: 49.108, tags: { shop: 'bakery', name: 'Хлеб' } },
      // Без координат — выбрасываем.
      { type: 'node', id: 5, tags: { amenity: 'cafe', name: 'Призрак' } },
    ],
  };

  it('берёт только известные виды мест и только с названием', () => {
    const places = parseOverpassPlaces(payload, CENTER);
    expect(places.map((place) => place.title)).toEqual(['Кофейня', 'Парк Горького']);
  });

  it('русское название предпочтительнее местного', () => {
    const [, park] = parseOverpassPlaces(payload, CENTER);
    expect(park!.title).toBe('Парк Горького');
  });

  it('вид, радиус и награда берутся из правила', () => {
    const [cafe, park] = parseOverpassPlaces(payload, CENTER);
    expect(cafe).toMatchObject({ type: 'cafe', subtitle: 'Кафе', radiusM: 70, xpReward: 50 });
    expect(park).toMatchObject({ type: 'park', subtitle: 'Парк', radiusM: 120, xpReward: 60 });
  });

  it('ближние места идут первыми', () => {
    const places = parseOverpassPlaces(payload, CENTER);
    expect(places[0]!.title).toBe('Кофейня');
  });

  it('один и тот же объект точкой и контуром схлопывается', () => {
    const doubled = {
      elements: [
        { type: 'node', id: 10, lat: 55.8, lon: 49.11, tags: { leisure: 'park', name: 'Сквер' } },
        {
          type: 'way',
          id: 11,
          center: { lat: 55.80001, lon: 49.11001 },
          tags: { leisure: 'park', name: 'Сквер' },
        },
      ],
    };
    expect(parseOverpassPlaces(doubled, CENTER)).toHaveLength(1);
  });

  it('список ограничен по длине', () => {
    const many = {
      elements: Array.from({ length: MAX_PLACES * 3 }, (_, index) => ({
        type: 'node',
        id: index,
        lat: 55.79 + index / 10_000,
        lon: 49.1,
        tags: { amenity: 'cafe', name: `Кафе ${index}` },
      })),
    };
    expect(parseOverpassPlaces(many, CENTER)).toHaveLength(MAX_PLACES);
  });

  it('достопримечательности не вытесняются ближними кафе', () => {
    const many = {
      elements: [
        ...Array.from({ length: MAX_PLACES * 2 }, (_, index) => ({
          type: 'node',
          id: 100 + index,
          lat: 55.7963 + index / 1_000_000,
          lon: 49.1088,
          tags: { amenity: 'cafe', name: `Кафе ${index}` },
        })),
        // Кремль на другом конце города: дальше всех, но идти хочется туда.
        {
          type: 'way',
          id: 1,
          center: { lat: 55.7989, lon: 49.1054 },
          tags: { historic: 'castle', 'name:ru': 'Казанский кремль' },
        },
      ],
    };

    const places = parseOverpassPlaces(many, CENTER);
    expect(places.map((place) => place.title)).toContain('Казанский кремль');
  });

  it('церковь без отметки в Викиданных не считается достопримечательностью', () => {
    const worship = {
      elements: [
        {
          type: 'way',
          id: 20,
          center: { lat: 55.7, lon: 49.1 },
          tags: { amenity: 'place_of_worship', name: 'Храм у дороги' },
        },
        {
          type: 'way',
          id: 21,
          center: { lat: 55.71, lon: 49.1 },
          tags: { amenity: 'place_of_worship', name: 'Кул-Шариф', wikidata: 'Q1146524' },
        },
      ],
    };

    const places = parseOverpassPlaces(worship, CENTER);
    expect(places.map((place) => place.title)).toEqual(['Кул-Шариф']);
    expect(places[0]).toMatchObject({ type: 'landmark', xpReward: 100 });
  });

  it('мусор вместо ответа не роняет разбор', () => {
    for (const bad of [null, undefined, {}, { elements: 'нет' }, 'строка']) {
      expect(parseOverpassPlaces(bad, CENTER)).toEqual([]);
    }
  });
});
