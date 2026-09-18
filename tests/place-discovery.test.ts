import { describe, expect, it } from 'vitest';

import { reachedPlaces, type DiscoverablePlace } from '@/features/places/discovery';

const HOME = { lat: 55.7963, lng: 49.1088 };

/** Смещение на север, метры -> градусы широты. */
function north(meters: number) {
  return { lat: HOME.lat + meters / 111_320, lng: HOME.lng };
}

// Парк и кафе на одном углу в двухстах метрах от дома, но с разным
// радиусом: у парка он большой, у кафе — маленький.
const places: DiscoverablePlace[] = [
  { id: 'park', ...north(200), radiusM: 120, title: 'Парк', xpReward: 60 },
  { id: 'cafe', ...north(200), radiusM: 70, title: 'Кафе', xpReward: 50 },
  { id: 'far', ...north(900), radiusM: 80, title: 'Далеко', xpReward: 50 },
];

describe('до каких мест дотянулись', () => {
  it('из дома — ни до какого', () => {
    expect(reachedPlaces(places, HOME)).toEqual([]);
  });

  it('придя на место, открываем всё, что там есть', () => {
    const atPlaces = reachedPlaces(places, north(200));
    expect(atPlaces.map((place) => place.id)).toEqual(['park', 'cafe']);
  });

  it('большой радиус срабатывает раньше маленького', () => {
    // Сто метров от дома: до парка ещё сто, и он уже засчитан, а кафе нет.
    const approaching = reachedPlaces(places, north(100));
    expect(approaching.map((place) => place.id)).toEqual(['park']);
  });

  it('далёкое место не открывается', () => {
    expect(reachedPlaces(places, north(200)).some((place) => place.id === 'far')).toBe(false);
  });

  it('пустой список мест ничего не ломает', () => {
    expect(reachedPlaces([], HOME)).toEqual([]);
  });
});
