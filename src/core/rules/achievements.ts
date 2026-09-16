/**
 * Ачивки как данные, а не как код.
 *
 * Каждое правило — чистая функция от снимка прогресса. Это даёт три вещи:
 * их можно прогнать на истории при добавлении новой ачивки (backfill),
 * их можно тестировать без эмулятора, и их можно один в один перенести
 * на сервер, когда появится валидация.
 */

export interface ProgressSnapshot {
  totalDistanceM: number;
  totalWalks: number;
  exploredCells: number;
  discoveredPlaces: number;
  currentStreakDays: number;
  bestStreakDays: number;
  /** Прогулок, начатых после заката. */
  nightWalks: number;
  /** Самая длинная одиночная прогулка. */
  longestWalkM: number;
  /** Доля открытия домашнего региона, 0..1. */
  homeRegionRatio: number;
  /** Разных календарных дней с прогулками. */
  activeDays: number;
}

export const EMPTY_SNAPSHOT: ProgressSnapshot = {
  totalDistanceM: 0,
  totalWalks: 0,
  exploredCells: 0,
  discoveredPlaces: 0,
  currentStreakDays: 0,
  bestStreakDays: 0,
  nightWalks: 0,
  longestWalkM: 0,
  homeRegionRatio: 0,
  activeDays: 0,
};

export interface AchievementDef {
  code: string;
  title: string;
  description: string;
  xpReward: number;
  /** Текущее значение и цель — для прогресс-бара на вкладке «Ачивки». */
  progress: (s: ProgressSnapshot) => { current: number; target: number };
}

const counter =
  (key: keyof ProgressSnapshot, target: number) =>
  (s: ProgressSnapshot) => ({ current: s[key], target });

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  {
    code: 'first-steps',
    title: 'Первые шаги',
    description: 'Первая прогулка',
    xpReward: 50,
    progress: counter('totalWalks', 1),
  },
  {
    code: 'night-wanderer',
    title: 'Ночной бродяга',
    description: '5 прогулок после заката',
    xpReward: 150,
    progress: counter('nightWalks', 5),
  },
  {
    code: 'streak-7',
    title: 'Неделя в пути',
    description: '7 дней подряд',
    xpReward: 200,
    progress: counter('bestStreakDays', 7),
  },
  {
    code: 'streak-30',
    title: 'Месяц в пути',
    description: '30 дней подряд',
    xpReward: 750,
    progress: counter('bestStreakDays', 30),
  },
  {
    code: 'distance-10k',
    title: 'Десятка',
    description: '10 км суммарно',
    xpReward: 100,
    progress: (s) => ({ current: s.totalDistanceM, target: 10_000 }),
  },
  {
    code: 'distance-100k',
    title: 'Сотня',
    description: '100 км суммарно',
    xpReward: 500,
    progress: (s) => ({ current: s.totalDistanceM, target: 100_000 }),
  },
  {
    code: 'marathon',
    title: 'Марафонец',
    description: 'Одна прогулка длиннее 15 км',
    xpReward: 400,
    progress: (s) => ({ current: s.longestWalkM, target: 15_000 }),
  },
  {
    code: 'explorer-10',
    title: 'Разведчик',
    description: 'Открыть 10% домашнего района',
    xpReward: 250,
    progress: (s) => ({ current: Math.round(s.homeRegionRatio * 1000), target: 100 }),
  },
  {
    code: 'explorer-50',
    title: 'Картограф',
    description: 'Открыть половину домашнего района',
    xpReward: 1000,
    progress: (s) => ({ current: Math.round(s.homeRegionRatio * 1000), target: 500 }),
  },
  {
    code: 'places-10',
    title: 'Краевед',
    description: 'Найти 10 мест',
    xpReward: 200,
    progress: counter('discoveredPlaces', 10),
  },
] as const;

export const ACHIEVEMENTS_BY_CODE = new Map(ACHIEVEMENTS.map((a) => [a.code, a]));

export function isUnlocked(def: AchievementDef, snapshot: ProgressSnapshot): boolean {
  const { current, target } = def.progress(snapshot);
  return current >= target;
}

export interface EvaluationResult {
  /** Ачивки, открывшиеся именно сейчас. */
  newlyUnlocked: AchievementDef[];
  xpAwarded: number;
}

/**
 * Прогоняет все правила по снимку. `alreadyUnlocked` передаётся снаружи,
 * чтобы функция осталась чистой и её можно было применять к любой точке
 * истории — в том числе при backfill после добавления новой ачивки.
 */
export function evaluate(
  snapshot: ProgressSnapshot,
  alreadyUnlocked: ReadonlySet<string>,
): EvaluationResult {
  const newlyUnlocked: AchievementDef[] = [];
  let xpAwarded = 0;

  for (const def of ACHIEVEMENTS) {
    if (alreadyUnlocked.has(def.code)) continue;
    if (!isUnlocked(def, snapshot)) continue;
    newlyUnlocked.push(def);
    xpAwarded += def.xpReward;
  }

  return { newlyUnlocked, xpAwarded };
}
