import { afterEach, describe, expect, it, vi } from 'vitest';

import { haversineMeters } from '@/core/geo/mercator';
import { MockFriendsProvider, isFresh, POSITION_FRESH_MS } from '@/features/friends';
import type { Friend } from '@/features/friends';

const KAZAN = { lat: 55.7963, lng: 49.1088 };

afterEach(() => {
  vi.useRealTimers();
});

function firstEmission(): Friend[] {
  const provider = new MockFriendsProvider(KAZAN);
  let received: Friend[] = [];
  const unsubscribe = provider.subscribe((friends) => {
    received = friends;
  });
  unsubscribe();
  return received;
}

describe('демо-друзья', () => {
  it('отдают список сразу при подписке, а не после первого тика', () => {
    expect(firstEmission()).toHaveLength(3);
  });

  it('ходят рядом: не дальше километра от точки отсчёта', () => {
    for (const friend of firstEmission()) {
      expect(friend.position).not.toBeNull();
      const distance = haversineMeters(KAZAN, friend.position!);
      expect(distance).toBeLessThan(1000);
      expect(distance).toBeGreaterThan(50);
    }
  });

  it('держат круг круглым на широте Казани', () => {
    // Долгота сжимается с широтой: без поправки на косинус круг вытянулся бы
    // по горизонтали, и «прогулка по кругу» превратилась бы в эллипс.
    vi.useFakeTimers();
    const radii: number[] = [];

    for (let step = 0; step < 12; step += 1) {
      vi.setSystemTime(step * 7_500);
      const lena = firstEmission().find((friend) => friend.id === 'friend-lena');
      radii.push(haversineMeters(KAZAN, lena!.position!));
    }

    const min = Math.min(...radii);
    const max = Math.max(...radii);
    expect(max - min).toBeLessThan(min * 0.05);
  });

  it('у каждого свой цвет — иначе метки на карте не различить', () => {
    const colors = firstEmission().map((friend) => friend.color);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it('помнят посещённые места с координатами рядом', () => {
    const visits = firstEmission().flatMap((friend) => friend.visits);
    expect(visits.length).toBeGreaterThan(0);

    for (const visit of visits) {
      expect(visit.title.length).toBeGreaterThan(0);
      expect(haversineMeters(KAZAN, visit)).toBeLessThan(1500);
      expect(visit.visitedAt).toBeLessThan(Date.now() + 1000);
    }
  });

  it('перестают слать обновления после отписки', () => {
    vi.useFakeTimers();
    const provider = new MockFriendsProvider(KAZAN);
    let calls = 0;
    const unsubscribe = provider.subscribe(() => {
      calls += 1;
    });

    expect(calls).toBe(1);
    vi.advanceTimersByTime(10_000);
    expect(calls).toBeGreaterThan(1);

    const afterUnsubscribe = calls;
    unsubscribe();
    vi.advanceTimersByTime(30_000);
    expect(calls).toBe(afterUnsubscribe);
  });
});

describe('свежесть позиции', () => {
  it('свежей считается недавняя', () => {
    const now = Date.now();
    expect(isFresh({ lat: 0, lng: 0, updatedAt: now - 1000 }, now)).toBe(true);
  });

  it('устаревшая — нет', () => {
    const now = Date.now();
    expect(isFresh({ lat: 0, lng: 0, updatedAt: now - POSITION_FRESH_MS - 1 }, now)).toBe(false);
  });
});
