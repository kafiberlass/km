import { describe, expect, it } from 'vitest';

import {
  ACHIEVEMENTS,
  EMPTY_SNAPSHOT,
  evaluate,
  isUnlocked,
} from '@/core/rules/achievements';
import {
  currentStreak,
  isStreakAtRisk,
  localDateKey,
  registerActivity,
} from '@/core/rules/streak';
import { applyXp, levelProgress, levelXpRequirement, totalXp } from '@/core/rules/xp';

describe('xp', () => {
  it('формула совпадает с макетом: на 12 уровне до 13-го нужно 3000', () => {
    expect(levelXpRequirement(12)).toBe(3000);
  });

  it('прогресс из макета — 2340/3000', () => {
    const progress = levelProgress({ level: 12, xp: 2340 });
    expect(progress.required).toBe(3000);
    expect(progress.ratio).toBeCloseTo(0.78, 5);
  });

  it('уровень поднимается, остаток переносится', () => {
    const result = applyXp({ level: 12, xp: 2340 }, 800);
    expect(result.level).toBe(13);
    expect(result.xp).toBe(140);
    expect(result.levelUps).toBe(1);
  });

  it('крупное начисление даёт несколько уровней сразу', () => {
    const result = applyXp({ level: 1, xp: 0 }, 10_000);
    expect(result.levelUps).toBeGreaterThan(1);
    expect(result.xp).toBeLessThan(levelXpRequirement(result.level));
  });

  it('отрицательное и нулевое начисление ничего не меняет', () => {
    const state = { level: 5, xp: 100 };
    expect(applyXp(state, 0)).toMatchObject({ ...state, levelUps: 0 });
    expect(applyXp(state, -50)).toMatchObject({ ...state, levelUps: 0 });
  });

  it('totalXp обратим относительно applyXp', () => {
    const grown = applyXp({ level: 1, xp: 0 }, 7_777);
    expect(totalXp(grown)).toBe(7_777);
  });
});

describe('streak', () => {
  const base = { streakDays: 0, lastActiveDate: null, bestStreak: 0 };

  it('первая активность начинает стрик', () => {
    const result = registerActivity(base, '2026-09-16');
    expect(result.change).toBe('started');
    expect(result.state.streakDays).toBe(1);
  });

  it('вторая прогулка в тот же день не удваивает стрик', () => {
    const day1 = registerActivity(base, '2026-09-16').state;
    const again = registerActivity(day1, '2026-09-16');
    expect(again.change).toBe('same-day');
    expect(again.state.streakDays).toBe(1);
  });

  it('следующий день продолжает стрик и двигает рекорд', () => {
    const day1 = registerActivity(base, '2026-09-16').state;
    const day2 = registerActivity(day1, '2026-09-17');
    expect(day2.change).toBe('continued');
    expect(day2.state.streakDays).toBe(2);
    expect(day2.state.bestStreak).toBe(2);
  });

  it('пропуск дня обнуляет стрик, но не рекорд', () => {
    let state = registerActivity(base, '2026-09-16').state;
    state = registerActivity(state, '2026-09-17').state;
    state = registerActivity(state, '2026-09-18').state;
    const broken = registerActivity(state, '2026-09-21');

    expect(broken.change).toBe('broken');
    expect(broken.state.streakDays).toBe(1);
    expect(broken.state.bestStreak).toBe(3);
  });

  it('стрик протухает при чтении, а не хранится «вечным»', () => {
    const state = { streakDays: 7, lastActiveDate: '2026-09-10', bestStreak: 7 };
    expect(currentStreak(state, '2026-09-10')).toBe(7);
    expect(currentStreak(state, '2026-09-11')).toBe(7); // вчера гулял — ещё жив
    expect(currentStreak(state, '2026-09-12')).toBe(0);
  });

  it('под угрозой ровно в тот день, когда стрик ещё можно спасти', () => {
    const state = { streakDays: 7, lastActiveDate: '2026-09-15', bestStreak: 7 };
    expect(isStreakAtRisk(state, '2026-09-16')).toBe(true);
    expect(isStreakAtRisk(state, '2026-09-15')).toBe(false);
    expect(isStreakAtRisk(state, '2026-09-18')).toBe(false);
  });

  it('локальная дата считается по таймзоне, а не по UTC', () => {
    // 2026-09-16 22:00 UTC — во Владивостоке (UTC+10) это уже 17 сентября.
    const t = Date.UTC(2026, 8, 16, 22, 0, 0);
    expect(localDateKey(t, 'UTC')).toBe('2026-09-16');
    expect(localDateKey(t, 'Asia/Vladivostok')).toBe('2026-09-17');
  });
});

describe('achievements', () => {
  it('на пустом профиле ничего не открыто', () => {
    const { newlyUnlocked } = evaluate(EMPTY_SNAPSHOT, new Set());
    expect(newlyUnlocked).toHaveLength(0);
  });

  it('«Ночной бродяга» — ровно 5 прогулок после заката, как в макете', () => {
    const def = ACHIEVEMENTS.find((a) => a.code === 'night-wanderer')!;
    expect(def.xpReward).toBe(150);
    expect(isUnlocked(def, { ...EMPTY_SNAPSHOT, nightWalks: 4 })).toBe(false);
    expect(isUnlocked(def, { ...EMPTY_SNAPSHOT, nightWalks: 5 })).toBe(true);
  });

  it('уже открытые не выдаются повторно', () => {
    const snapshot = { ...EMPTY_SNAPSHOT, totalWalks: 1, nightWalks: 5 };
    const first = evaluate(snapshot, new Set());
    expect(first.newlyUnlocked.length).toBeGreaterThan(0);

    const codes = new Set(first.newlyUnlocked.map((a) => a.code));
    const second = evaluate(snapshot, codes);
    expect(second.newlyUnlocked).toHaveLength(0);
    expect(second.xpAwarded).toBe(0);
  });

  it('XP за ачивки суммируется корректно', () => {
    const snapshot = { ...EMPTY_SNAPSHOT, totalWalks: 1, nightWalks: 5 };
    const { newlyUnlocked, xpAwarded } = evaluate(snapshot, new Set());
    const expected = newlyUnlocked.reduce((sum, a) => sum + a.xpReward, 0);
    expect(xpAwarded).toBe(expected);
  });

  it('коды ачивок уникальны — иначе backfill выдаст дубли', () => {
    const codes = ACHIEVEMENTS.map((a) => a.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
