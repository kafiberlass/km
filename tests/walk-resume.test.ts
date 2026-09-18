import { describe, expect, it } from 'vitest';

import { restoreWalk, type StoredPoint } from '@/core/walk/restore';
import {
  MAX_WALK_AGE_MS,
  isWalkResumable,
  parseActiveWalk,
  serializeActiveWalk,
} from '@/core/walk/session';

const walk = { sessionId: 'w-abc', startedAt: 1_700_000_000_000, source: 'device' };

describe('запись об идущей прогулке', () => {
  it('переживает сериализацию', () => {
    expect(parseActiveWalk(serializeActiveWalk(walk))).toEqual(walk);
  });

  it('на мусоре возвращает null, а не падает', () => {
    expect(parseActiveWalk(null)).toBeNull();
    expect(parseActiveWalk('')).toBeNull();
    expect(parseActiveWalk('не json')).toBeNull();
    expect(parseActiveWalk('null')).toBeNull();
    expect(parseActiveWalk('[]')).toBeNull();
    expect(parseActiveWalk('{"startedAt":1}')).toBeNull();
    expect(parseActiveWalk('{"sessionId":"w-1"}')).toBeNull();
    expect(parseActiveWalk('{"sessionId":"w-1","startedAt":"вчера"}')).toBeNull();
  });

  it('источник по умолчанию — устройство', () => {
    expect(parseActiveWalk('{"sessionId":"w-1","startedAt":5}')?.source).toBe('device');
  });
});

describe('можно ли продолжать прогулку', () => {
  it('свежую — да', () => {
    expect(isWalkResumable(walk, walk.startedAt + 60_000)).toBe(true);
  });

  it('забытую со вчера — нет', () => {
    expect(isWalkResumable(walk, walk.startedAt + MAX_WALK_AGE_MS + 1)).toBe(false);
  });

  it('с часами, переведёнными назад, — нет', () => {
    expect(isWalkResumable(walk, walk.startedAt - 1000)).toBe(false);
  });
});

describe('восстановление счётчиков из базы', () => {
  const base = { accuracy: 8, timestamp: 1_700_000_000_000 };

  it('пустая история ничего не восстанавливает', () => {
    const result = restoreWalk([]);
    expect(result).toEqual({
      distanceM: 0,
      segmentIndex: 0,
      liveSegment: [],
      last: null,
      points: 0,
    });
  });

  it('считает пройденное по точкам одного сегмента', () => {
    const points: StoredPoint[] = [
      { ...base, segment: 0, lat: 55.76, lng: 37.62, timestamp: base.timestamp },
      { ...base, segment: 0, lat: 55.761, lng: 37.62, timestamp: base.timestamp + 20_000 },
      { ...base, segment: 0, lat: 55.762, lng: 37.62, timestamp: base.timestamp + 40_000 },
    ];

    const result = restoreWalk(points);
    // Сотая доля градуса широты — примерно 111 метров на два шага.
    expect(result.distanceM).toBeGreaterThan(200);
    expect(result.distanceM).toBeLessThan(240);
    expect(result.points).toBe(3);
  });

  it('через разрыв трека расстояние не приписывается', () => {
    const together: StoredPoint[] = [
      { ...base, segment: 0, lat: 55.76, lng: 37.62 },
      { ...base, segment: 0, lat: 55.761, lng: 37.62 },
    ];
    const broken: StoredPoint[] = [
      { ...base, segment: 0, lat: 55.76, lng: 37.62 },
      { ...base, segment: 1, lat: 55.9, lng: 37.62 },
      { ...base, segment: 1, lat: 55.901, lng: 37.62 },
    ];

    expect(restoreWalk(broken).distanceM).toBeCloseTo(restoreWalk(together).distanceM, 1);
  });

  it('продолжает последний сегмент, а не начинает новый', () => {
    const points: StoredPoint[] = [
      { ...base, segment: 0, lat: 55.76, lng: 37.62 },
      { ...base, segment: 2, lat: 55.9, lng: 37.62 },
      { ...base, segment: 2, lat: 55.901, lng: 37.63 },
    ];

    const result = restoreWalk(points);
    expect(result.segmentIndex).toBe(2);
    expect(result.liveSegment).toEqual([
      { lat: 55.9, lng: 37.62 },
      { lat: 55.901, lng: 37.63 },
    ]);
  });

  it('последняя точка отдаётся фильтру целиком', () => {
    const points: StoredPoint[] = [
      { segment: 0, lat: 55.76, lng: 37.62, accuracy: 12, timestamp: 100 },
      { segment: 0, lat: 55.761, lng: 37.63, accuracy: 7, timestamp: 200 },
    ];

    expect(restoreWalk(points).last).toEqual({
      lat: 55.761,
      lng: 37.63,
      accuracy: 7,
      timestamp: 200,
    });
  });
});
