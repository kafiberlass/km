import { describe, expect, it } from 'vitest';

import { MAX_PLACES, buildOverpassQuery, parseOverpassPlaces } from '@/features/places/osm';

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

  it('мусор вместо ответа не роняет разбор', () => {
    for (const bad of [null, undefined, {}, { elements: 'нет' }, 'строка']) {
      expect(parseOverpassPlaces(bad, CENTER)).toEqual([]);
    }
  });
});
