import { describe, expect, it } from 'vitest';

import { daysWord, streakFromDays } from '@/core/rules/streak';

describe('серия по истории прогулок', () => {
  it('считает подряд идущие дни', () => {
    expect(streakFromDays(['2026-09-20', '2026-09-21', '2026-09-22'], '2026-09-22')).toBe(3);
  });

  it('несколько прогулок за день считаются одним днём', () => {
    const days = ['2026-09-21', '2026-09-21', '2026-09-22', '2026-09-22'];
    expect(streakFromDays(days, '2026-09-22')).toBe(2);
  });

  it('вчерашняя прогулка серию не обрывает — день ещё не кончился', () => {
    expect(streakFromDays(['2026-09-20', '2026-09-21'], '2026-09-22')).toBe(2);
  });

  it('пропущенный день обрывает', () => {
    expect(streakFromDays(['2026-09-18', '2026-09-19', '2026-09-22'], '2026-09-22')).toBe(1);
  });

  it('давно не гулял — серии нет', () => {
    expect(streakFromDays(['2026-09-10', '2026-09-11'], '2026-09-22')).toBe(0);
  });

  it('порядок записей не важен', () => {
    const shuffled = ['2026-09-22', '2026-09-20', '2026-09-21'];
    expect(streakFromDays(shuffled, '2026-09-22')).toBe(3);
  });

  it('пустая история — ноль, а не единица', () => {
    expect(streakFromDays([], '2026-09-22')).toBe(0);
  });
});

describe('счёт дней по-русски', () => {
  it('склоняет как положено', () => {
    expect(`1 ${daysWord(1)}`).toBe('1 день');
    expect(`2 ${daysWord(2)}`).toBe('2 дня');
    expect(`5 ${daysWord(5)}`).toBe('5 дней');
    expect(`11 ${daysWord(11)}`).toBe('11 дней');
    expect(`21 ${daysWord(21)}`).toBe('21 день');
    expect(`22 ${daysWord(22)}`).toBe('22 дня');
    expect(`111 ${daysWord(111)}`).toBe('111 дней');
    expect(`0 ${daysWord(0)}`).toBe('0 дней');
  });
});
