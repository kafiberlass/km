import { describe, expect, it } from 'vitest';

import {
  EMPTY_TOTALS,
  formatDistance,
  formatDuration,
  groupByDay,
  totalsOf,
  totalsSince,
  type WalkRow,
} from '@/core/walk/history';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 2, 15, 12, 0, 0);

function walk(id: string, startedAt: number, distanceM: number, durationS = 1800): WalkRow {
  return { id, startedAt, endedAt: startedAt + durationS * 1000, distanceM, durationS, newCells: 10, isNight: false };
}

describe('итоги', () => {
  const rows = [walk('a', NOW - DAY, 3000), walk('b', NOW - 10 * DAY, 5000), walk('c', NOW - 40 * DAY, 2000)];

  it('пустая история — нули, а не пропуски', () => {
    expect(totalsOf([])).toEqual(EMPTY_TOTALS);
  });

  it('складывает всё, что есть', () => {
    expect(totalsOf(rows)).toMatchObject({ walks: 3, distanceM: 10_000, newCells: 30 });
  });

  it('за неделю — только последние семь суток', () => {
    expect(totalsSince(rows, 7, NOW)).toMatchObject({ walks: 1, distanceM: 3000 });
  });

  it('за месяц — тридцать суток, сорокадневная прогулка не входит', () => {
    expect(totalsSince(rows, 30, NOW)).toMatchObject({ walks: 2, distanceM: 8000 });
  });
});

describe('группировка по дням', () => {
  it('прогулки одного дня оказываются вместе', () => {
    const morning = walk('a', Date.UTC(2026, 2, 14, 6, 0), 2000);
    const evening = walk('b', Date.UTC(2026, 2, 14, 19, 0), 4000);
    const groups = groupByDay([morning, evening], 'UTC');

    expect(groups).toHaveLength(1);
    expect(groups[0]!.totals.distanceM).toBe(6000);
  });

  it('свежие дни сверху, а внутри дня — свежие прогулки', () => {
    const groups = groupByDay(
      [
        walk('старая', Date.UTC(2026, 2, 10, 9, 0), 1000),
        walk('утро', Date.UTC(2026, 2, 14, 8, 0), 1000),
        walk('вечер', Date.UTC(2026, 2, 14, 20, 0), 1000),
      ],
      'UTC',
    );

    expect(groups.map((group) => group.dateKey)).toEqual(['2026-03-14', '2026-03-10']);
    expect(groups[0]!.rows.map((row) => row.id)).toEqual(['вечер', 'утро']);
  });

  it('день считается по местному времени, а не по Гринвичу', () => {
    // Час ночи 15 марта в Казани — это ещё 14 марта по UTC.
    const night = walk('ночная', Date.UTC(2026, 2, 14, 22, 30), 1500);

    expect(groupByDay([night], 'UTC')[0]!.dateKey).toBe('2026-03-14');
    expect(groupByDay([night], 'Europe/Moscow')[0]!.dateKey).toBe('2026-03-15');
  });
});

describe('как это читается', () => {
  it('время: часы появляются только когда они есть', () => {
    expect(formatDuration(0)).toBe('0 мин');
    expect(formatDuration(1800)).toBe('30 мин');
    expect(formatDuration(3600)).toBe('1 ч');
    expect(formatDuration(4800)).toBe('1 ч 20 мин');
  });

  it('расстояние: короткие прогулки не превращаются в «0.0 км»', () => {
    expect(formatDistance(420)).toBe('420 м');
    expect(formatDistance(1500)).toBe('1.5 км');
  });
});
