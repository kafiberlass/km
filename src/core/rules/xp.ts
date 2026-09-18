/**
 * Правила начисления опыта и уровней.
 *
 * Этот модуль намеренно не импортирует ничего из React Native и из БД:
 * когда появится сервер, тот же самый файл переедет в общий пакет и станет
 * источником истины для валидации. Клиент считает оптимистично и сразу
 * показывает тост, сервер пересчитывает тем же кодом.
 */

/** Выше не растём. Сотня — обозримый потолок: его видно с первого уровня. */
export const MAX_LEVEL = 100;

/**
 * Требование к следующему уровню.
 *
 * Степень 1.15 — почти линейно, но с утяжелением: иначе сотый уровень
 * либо берётся за месяц, либо не берётся никогда. Подобрано по тому,
 * сколько опыта приносит живая прогулка (около 250 XP за активный день:
 * километры, новые ячейки, квартал и бонус за первый выход):
 *
 *   10 уровень  — неделя
 *   20 уровень  — месяц
 *   50 уровень  — полгода
 *   100 уровень — примерно два года
 *
 * Округление до десятков — чтобы в интерфейсе не мелькали числа вроде 1673.
 */
export function levelXpRequirement(level: number): number {
  const capped = Math.min(Math.max(1, level), MAX_LEVEL);
  // На потолке возвращаем требование предыдущего уровня, а не ноль:
  // полоса прогресса делит на это число, и делить на ноль ей нечем.
  const step = capped >= MAX_LEVEL ? MAX_LEVEL - 1 : capped;
  return Math.round((40 + 22 * step ** 1.15) / 10) * 10;
}

/**
 * Звания по уровням.
 *
 * Уровень — это число, а звание — то, что человек про себя говорит вслух.
 * Пороги неровные: в начале они частые, чтобы новое звание пришло в первую
 * же неделю, дальше реже, потому что и уровни идут медленнее.
 */
const TITLES: readonly { from: number; title: string }[] = [
  { from: 1, title: 'Прохожий' },
  { from: 5, title: 'Гуляка' },
  { from: 10, title: 'Следопыт' },
  { from: 20, title: 'Бродяга' },
  { from: 30, title: 'Ночной бродяга' },
  { from: 40, title: 'Разведчик' },
  { from: 50, title: 'Картограф' },
  { from: 60, title: 'Первопроходец' },
  { from: 70, title: 'Хранитель троп' },
  { from: 80, title: 'Знаток города' },
  { from: 90, title: 'Легенда района' },
  { from: MAX_LEVEL, title: 'Тот, кто открыл город' },
];

export function levelTitle(level: number): string {
  let title = TITLES[0]!.title;
  for (const band of TITLES) {
    if (level >= band.from) title = band.title;
  }
  return title;
}

/** Сколько опыта нужно всего, чтобы дойти до этого уровня с нуля. */
export function totalXpForLevel(level: number): number {
  let sum = 0;
  for (let current = 1; current < Math.min(level, MAX_LEVEL); current += 1) {
    sum += levelXpRequirement(current);
  }
  return sum;
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
  while (level < MAX_LEVEL && xp >= levelXpRequirement(level)) {
    xp -= levelXpRequirement(level);
    level += 1;
    levelUps += 1;
  }

  // На потолке опыт не копится дальше полосы: показывать «1200 из 4380»
  // там, где расти уже некуда, — врать человеку про остаток.
  if (level >= MAX_LEVEL) {
    level = MAX_LEVEL;
    xp = Math.min(xp, levelXpRequirement(MAX_LEVEL));
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
