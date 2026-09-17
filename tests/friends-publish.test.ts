import { describe, expect, it } from 'vitest';

import {
  PUBLISH_MIN_DISTANCE_M,
  PUBLISH_MIN_INTERVAL_MS,
  shouldPublish,
} from '@/features/friends/publish';

const KAZAN = { lat: 55.7963, lng: 49.1088 };

/** Смещение на север на заданное число метров. */
function north(point: { lat: number; lng: number }, meters: number) {
  return { lat: point.lat + meters / 111_320, lng: point.lng };
}

describe('когда отправлять позицию друзьям', () => {
  it('первая точка уходит всегда', () => {
    expect(shouldPublish(null, KAZAN, 0)).toBe(true);
  });

  it('молчит, пока человек стоит на месте', () => {
    const previous = { point: KAZAN, at: 0 };
    expect(shouldPublish(previous, north(KAZAN, 5), 10_000)).toBe(false);
  });

  it('отправляет после заметного смещения, не дожидаясь таймера', () => {
    const previous = { point: KAZAN, at: 0 };
    const moved = north(KAZAN, PUBLISH_MIN_DISTANCE_M + 10);
    expect(shouldPublish(previous, moved, 1000)).toBe(true);
  });

  it('отправляет по таймеру, даже если человек не сдвинулся', () => {
    const previous = { point: KAZAN, at: 0 };
    expect(shouldPublish(previous, KAZAN, PUBLISH_MIN_INTERVAL_MS)).toBe(true);
  });

  it('на прогулке шагом это примерно раз в минуту, а не раз в три секунды', () => {
    // 5 км/ч — это 83 метра в минуту: порог в 100 метров срабатывает
    // примерно тогда же, когда и таймер, то есть около 60 отправок в час,
    // а не 1200, как у демо-провайдера.
    let previous = { point: KAZAN, at: 0 };
    let published = 0;

    for (let second = 1; second <= 3600; second += 1) {
      const point = north(KAZAN, (83 / 60) * second);
      const now = second * 1000;
      if (shouldPublish(previous, point, now)) {
        published += 1;
        previous = { point, at: now };
      }
    }

    expect(published).toBeLessThanOrEqual(80);
    expect(published).toBeGreaterThan(30);
  });
});
