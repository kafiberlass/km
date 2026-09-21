import { describe, expect, it } from 'vitest';

import { DEFAULT_CRITTERS, pickCritters } from '@/features/fog/critters';

function track(count: number) {
  return Array.from({ length: count }, (_, i) => ({ x: i * 10, y: 0 }));
}

describe('живность на открытой земле', () => {
  it('расставляется одинаково при каждом пересчёте', () => {
    const first = pickCritters(track(200));
    const second = pickCritters(track(200));
    expect(first).toEqual(second);
  });

  it('не появляется там, где ещё не ходили', () => {
    expect(pickCritters([])).toEqual([]);
    expect(pickCritters([{ x: 0, y: 0 }])).toEqual([]);
  });

  it('стоит в стороне от линии пути, а не на ней', () => {
    // Прямой трек вдоль оси X: всё, что поперёк, обязано иметь y != 0.
    for (const spot of pickCritters(track(200))) {
      expect(Math.abs(spot.y)).toBeGreaterThan(0);
    }
  });

  it('часть уходит в туман — но меньшая', () => {
    const spots = pickCritters(track(600));
    const hidden = spots.filter((spot) => spot.hidden).length;

    expect(hidden).toBeGreaterThan(0);
    expect(hidden).toBeLessThan(spots.length / 2);
  });

  it('в тумане живность дальше от тропы, чем на открытом', () => {
    const spots = pickCritters(track(600));
    const open = spots.filter((s) => !s.hidden).map((s) => Math.abs(s.y));
    const hidden = spots.filter((s) => s.hidden).map((s) => Math.abs(s.y));

    expect(Math.max(...hidden)).toBeGreaterThan(Math.max(...open));
  });

  it('на длинной истории не разрастается бесконечно', () => {
    const spots = pickCritters(track(100_000));
    expect(spots.length).toBeLessThanOrEqual(DEFAULT_CRITTERS.maxCount);
  });

  it('бывает и трава, и рыбы', () => {
    const kinds = new Set(pickCritters(track(600)).map((spot) => spot.kind));
    expect(kinds).toEqual(new Set(['grass', 'fish']));
  });
});
