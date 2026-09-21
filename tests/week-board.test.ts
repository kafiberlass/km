import { describe, expect, it } from 'vitest';

import {
  WEEK_FRESH_MS,
  buildBoard,
  formatWeekDistance,
  type BoardPerson,
} from '@/features/friends/board';

const NOW = 1_780_000_000_000;

function person(id: string, name: string, weekM: number | null, weekAt = NOW): BoardPerson {
  return { id, name, avatar: null, color: '#000', weekM, weekAt };
}

const me = person('me', 'Я', 12_000);

describe('доска недели', () => {
  it('сортируется по пройденному, я — такая же строка, как все', () => {
    const rows = buildBoard(me, [person('a', 'Брат', 20_000), person('b', 'Мама', 5000)], NOW);

    expect(rows.map((row) => row.name)).toEqual(['Брат', 'Я', 'Мама']);
    expect(rows.map((row) => row.place)).toEqual([1, 2, 3]);
    expect(rows.find((row) => row.isMe)?.id).toBe('me');
  });

  it('полоска считается от лучшего результата', () => {
    const rows = buildBoard(me, [person('a', 'Брат', 24_000)], NOW);

    expect(rows[0]!.share).toBe(1);
    expect(rows[1]!.share).toBe(0.5);
  });

  it('никто никуда не ходил — полоски пустые, а не сломанные', () => {
    const rows = buildBoard(person('me', 'Я', 0), [person('a', 'Брат', 0)], NOW);
    for (const row of rows) expect(row.share).toBe(0);
  });

  it('те, кто ещё не делился, уходят вниз, но остаются в списке', () => {
    const rows = buildBoard(me, [person('a', 'Брат', null)], NOW);

    expect(rows.map((row) => row.name)).toEqual(['Я', 'Брат']);
    expect(rows[1]!.weekM).toBeNull();
  });

  it('несвежие числа помечаются, а не прячутся', () => {
    const old = person('a', 'Брат', 9000, NOW - WEEK_FRESH_MS - 1000);
    const [, brother] = buildBoard(me, [old], NOW);

    expect(brother!.stale).toBe(true);
  });

  it('своё число несвежим не бывает: оно считается прямо сейчас', () => {
    const rows = buildBoard({ ...me, weekAt: NOW - WEEK_FRESH_MS * 10 }, [], NOW);
    expect(rows[0]!.stale).toBe(false);
  });

  it('порядок при равенстве не прыгает', () => {
    const first = buildBoard(person('me', 'Я', 5000), [person('a', 'Брат', 5000)], NOW);
    const second = buildBoard(person('me', 'Я', 5000), [person('a', 'Брат', 5000)], NOW);
    expect(first.map((r) => r.id)).toEqual(second.map((r) => r.id));
  });
});

describe('запись расстояния', () => {
  it('метры и километры', () => {
    expect(formatWeekDistance(340)).toBe('340 м');
    expect(formatWeekDistance(3400)).toBe('3.4 км');
    expect(formatWeekDistance(null)).toBe('—');
  });
});
