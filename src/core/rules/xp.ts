/**
 * Правила начисления опыта и уровней.
 *
 * Этот модуль намеренно не импортирует ничего из React Native и из БД:
 * когда появится сервер, тот же самый файл переедет в общий пакет и станет
 * источником истины для валидации. Клиент считает оптимистично и сразу
 * показывает тост, сервер пересчитывает тем же кодом.
 */

/**
 * Требование к следующему уровню. Линейная формула выбрана под макет:
 * на 12 уровне до 13-го нужно ровно 3000 XP.
 */
export function levelXpRequirement(level: number): number {
  return 250 * Math.max(1, level);
}

export type XpKind =
  | 'distance'
  | 'new-cells'
  | 'district-completed'
  | 'place-discovered'
  | 'achievement'
  | 'streak-bonus'
  | 'first-walk-of-day';

export interface XpEvent {
  kind: XpKind;
  amount: number;
  /** Ссылка на источник: id места, код ачивки, id сессии. */
  ref?: string;
  createdAt: number;
}

export const XP_RATES = {
  /** За километр пройденного пути. */
  perKm: 10,
  /** За каждую новую открытую ячейку (~2150 м²). */
  perNewCell: 1,
  /** За впервые найденное место. */
  perPlace: 50,
  /**
   * За закрытый квартал.
   *
   * Заметно больше, чем набегает ячейками за ту же прогулку: награда
   * должна чувствоваться за доведение до конца, а не за сам факт ходьбы,
   * иначе кварталы не станут целью.
   */
  perDistrict: 150,
  /** Разовый бонус за первую прогулку в календарный день. */
  firstWalkOfDay: 25,
  /** Бонус за каждый день стрика, с потолком. */
  perStreakDay: 5,
  maxStreakBonus: 100,
} as const;

export function xpForDistance(distanceM: number): number {
  return Math.floor((distanceM / 1000) * XP_RATES.perKm);
}

export function xpForNewCells(cellCount: number): number {
  return cellCount * XP_RATES.perNewCell;
}

export function xpForDistricts(count: number): number {
  return count * XP_RATES.perDistrict;
}

export function xpForStreak(streakDays: number): number {
  return Math.min(XP_RATES.maxStreakBonus, streakDays * XP_RATES.perStreakDay);
}

export interface LevelState {
  level: number;
  /** Опыт внутри текущего уровня, не суммарный. */
  xp: number;
}

export interface LevelUpResult extends LevelState {
  /** Сколько уровней взято за это начисление — может быть больше одного. */
  levelUps: number;
}

export function applyXp(state: LevelState, amount: number): LevelUpResult {
  if (amount <= 0) return { ...state, levelUps: 0 };

  let { level, xp } = state;
  xp += amount;
  let levelUps = 0;

  // while, а не if: импорт длинного трека может дать несколько уровней разом.
  while (xp >= levelXpRequirement(level)) {
    xp -= levelXpRequirement(level);
    level += 1;
    levelUps += 1;
  }

  return { level, xp, levelUps };
}

export function levelProgress(state: LevelState): {
  current: number;
  required: number;
  ratio: number;
} {
  const required = levelXpRequirement(state.level);
  return {
    current: state.xp,
    required,
    ratio: required > 0 ? Math.min(1, state.xp / required) : 0,
  };
}

/** Суммарный опыт с нуля — нужен для лидербордов и для сверки с сервером. */
export function totalXp(state: LevelState): number {
  let sum = state.xp;
  for (let level = 1; level < state.level; level++) {
    sum += levelXpRequirement(level);
  }
  return sum;
}
