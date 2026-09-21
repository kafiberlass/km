import { describe, expect, it } from 'vitest';

import {
  MAX_DISTANCE_GOAL_M,
  MIN_DISTANCE_GOAL_M,
  distanceGoal,
  pickQuest,
  questProgress,
  type QuestContext,
} from '@/features/quests/quest';

const full: QuestContext = {
  places: [
    { id: 'p1', title: 'Кремль', type: 'landmark', distanceM: 1200 },
    { id: 'p2', title: 'Парк Горького', type: 'park', distanceM: 800 },
    { id: 'far', title: 'Голубые озёра', type: 'landmark', distanceM: 20_000 },
  ],
  districts: [
    { id: 'd1', ratio: 0.8 },
    { id: 'd2', ratio: 0.1 },
    { id: 'done', ratio: 1 },
  ],
  typicalM: 3000,
};

describe('дневная цель по расстоянию', () => {
  it('считается от привычного человеку, а не от круглого числа', () => {
    expect(distanceGoal(3000)).toBe(4000);
    expect(distanceGoal(6000)).toBe(7500);
  });

  it('не унижает того, кто ходит мало, и не мучает того, кто ходит много', () => {
    expect(distanceGoal(100)).toBe(MIN_DISTANCE_GOAL_M);
    expect(distanceGoal(50_000)).toBe(MAX_DISTANCE_GOAL_M);
  });

  it('без истории берётся разумное значение по умолчанию', () => {
    for (const bad of [0, -5, Number.NaN]) {
      const goal = distanceGoal(bad);
      expect(goal).toBeGreaterThanOrEqual(MIN_DISTANCE_GOAL_M);
      expect(goal).toBeLessThanOrEqual(MAX_DISTANCE_GOAL_M);
    }
  });
});

describe('выбор квеста', () => {
  it('в течение дня не меняется', () => {
    const first = pickQuest('2026-09-21', full);
    for (let i = 0; i < 10; i += 1) {
      expect(pickQuest('2026-09-21', full)).toEqual(first);
    }
  });

  it('в разные дни бывает разным', () => {
    const kinds = new Set<string>();
    for (let day = 1; day <= 28; day += 1) {
      const key = `2026-09-${String(day).padStart(2, '0')}`;
      kinds.add(pickQuest(key, full).kind);
    }
    expect(kinds.size).toBeGreaterThan(1);
  });

  it('не предлагает идти за двадцать километров', () => {
    for (let day = 1; day <= 31; day += 1) {
      const quest = pickQuest(`2026-03-${String(day).padStart(2, '0')}`, full);
      if (quest.kind === 'place') expect(quest.targetId).not.toBe('far');
    }
  });

  it('не предлагает закрывать уже закрытый квартал', () => {
    for (let day = 1; day <= 31; day += 1) {
      const quest = pickQuest(`2026-05-${String(day).padStart(2, '0')}`, full);
      if (quest.kind === 'district') expect(quest.targetId).not.toBe('done');
    }
  });

  it('на пустой карте остаётся расстояние — квест есть всегда', () => {
    const empty: QuestContext = { places: [], districts: [], typicalM: 0 };
    for (let day = 1; day <= 31; day += 1) {
      const quest = pickQuest(`2026-01-${String(day).padStart(2, '0')}`, empty);
      expect(quest.kind).toBe('distance');
      expect(quest.goalM).toBeGreaterThan(0);
    }
  });

  it('у любого квеста есть заголовок, подсказка и награда', () => {
    for (let day = 1; day <= 31; day += 1) {
      const quest = pickQuest(`2026-07-${String(day).padStart(2, '0')}`, full);
      expect(quest.title.length).toBeGreaterThan(0);
      expect(quest.hint.length).toBeGreaterThan(0);
      expect(quest.xpReward).toBeGreaterThan(0);
    }
  });
});

describe('выполнение квеста', () => {
  const state = { todayM: 0, openedPlaceIds: [] as string[], districtRatio: 0 };

  it('«дойти до места» закрывается открытием именно этого места', () => {
    const quest = { kind: 'place' as const, title: '', hint: '', xpReward: 1, targetId: 'p1', goalM: null };

    expect(questProgress(quest, { ...state, openedPlaceIds: ['p2'] }).done).toBe(false);
    expect(questProgress(quest, { ...state, openedPlaceIds: ['p2', 'p1'] }).done).toBe(true);
  });

  it('«пройти N» растёт полоской и закрывается на цели', () => {
    const quest = { kind: 'distance' as const, title: '', hint: '', xpReward: 1, targetId: null, goalM: 4000 };

    expect(questProgress(quest, { ...state, todayM: 0 }).ratio).toBe(0);
    expect(questProgress(quest, { ...state, todayM: 2000 }).ratio).toBe(0.5);
    expect(questProgress(quest, { ...state, todayM: 4000 }).done).toBe(true);
    // Перевыполнение не ломает полоску.
    expect(questProgress(quest, { ...state, todayM: 99_000 }).ratio).toBe(1);
  });

  it('«закрыть квартал» показывает проценты', () => {
    const quest = { kind: 'district' as const, title: '', hint: '', xpReward: 1, targetId: 'd1', goalM: null };

    expect(questProgress(quest, { ...state, districtRatio: 0.8 }).label).toBe('80%');
    expect(questProgress(quest, { ...state, districtRatio: 1 }).done).toBe(true);
  });
});
