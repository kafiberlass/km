/**
 * Стрик считается по ЛОКАЛЬНОЙ дате пользователя, а не по UTC.
 *
 * Если считать по UTC, человек в Владивостоке теряет стрик каждый вечер,
 * а в Лос-Анджелесе получает лишний день. Поэтому храним таймзону профиля
 * и сравниваем ключи вида `2026-09-16`.
 */

export type LocalDateKey = string;

/**
 * Локальная дата в формате YYYY-MM-DD.
 * `en-CA` выбран потому, что его формат по умолчанию — ISO-подобный.
 */
export function localDateKey(timestamp: number, timeZone: string): LocalDateKey {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(timestamp));
  } catch {
    // Hermes без полного ICU или неизвестная зона — деградируем до UTC,
    // это хуже, но не ломает приложение.
    return new Date(timestamp).toISOString().slice(0, 10);
  }
}

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function daysBetween(a: LocalDateKey, b: LocalDateKey): number {
  const parse = (key: LocalDateKey) => Date.parse(`${key}T00:00:00Z`);
  return Math.round((parse(b) - parse(a)) / 86_400_000);
}

export interface StreakState {
  streakDays: number;
  lastActiveDate: LocalDateKey | null;
  bestStreak: number;
}

export type StreakChange = 'started' | 'continued' | 'same-day' | 'broken';

export interface StreakResult {
  state: StreakState;
  change: StreakChange;
}

export function registerActivity(state: StreakState, today: LocalDateKey): StreakResult {
  if (!state.lastActiveDate) {
    return {
      state: { streakDays: 1, lastActiveDate: today, bestStreak: Math.max(1, state.bestStreak) },
      change: 'started',
    };
  }

  const gap = daysBetween(state.lastActiveDate, today);

  if (gap <= 0) {
    // Тот же день (или дата уехала назад — например, пользователь сменил зону).
    return { state, change: 'same-day' };
  }

  if (gap === 1) {
    const streakDays = state.streakDays + 1;
    return {
      state: {
        streakDays,
        lastActiveDate: today,
        bestStreak: Math.max(state.bestStreak, streakDays),
      },
      change: 'continued',
    };
  }

  return {
    state: { streakDays: 1, lastActiveDate: today, bestStreak: state.bestStreak },
    change: 'broken',
  };
}

/**
 * Актуальное значение стрика на момент просмотра.
 *
 * Хранимое значение «протухает»: если человек не гулял два дня, в базе всё
 * ещё лежит 7, но показывать надо 0. Пересчёт при чтении, а не по крону —
 * бэкенда нет, будить приложение некому.
 */
export function currentStreak(state: StreakState, today: LocalDateKey): number {
  if (!state.lastActiveDate) return 0;
  const gap = daysBetween(state.lastActiveDate, today);
  if (gap <= 0) return state.streakDays;
  if (gap === 1) return state.streakDays; // вчера гулял — стрик ещё жив
  return 0;
}

/** Сгорит ли стрик, если сегодня не выйти. Для текста локального пуша. */
export function isStreakAtRisk(state: StreakState, today: LocalDateKey): boolean {
  if (!state.lastActiveDate || state.streakDays === 0) return false;
  return daysBetween(state.lastActiveDate, today) === 1;
}

/**
 * Серия прямо по истории прогулок.
 *
 * Прежде число жило отдельным счётчиком в профиле и росло только в тот
 * момент, когда прогулка закрывалась. Если прогулка не закрылась (телефон
 * выключили, приложение выгрузили), день терялся, а следующая прогулка
 * видела разрыв в два дня и начинала серию заново — отсюда вечная
 * единица на огоньке.
 *
 * Здесь считается от самих прогулок: они записаны в базу, и соврать
 * им нечем. Счётчик в профиле остаётся — по нему начисляется опыт
 * за первую прогулку дня, — но показываем мы это.
 */
export function streakFromDays(
  days: readonly LocalDateKey[],
  today: LocalDateKey,
): number {
  const unique = [...new Set(days)].sort().reverse();
  if (unique.length === 0) return 0;

  // Серия жива, если последняя прогулка сегодня или вчера. Разрыв
  // больше суток — серия оборвалась.
  const fresh = daysBetween(unique[0]!, today);
  if (fresh > 1) return 0;

  let streak = 1;
  for (let i = 1; i < unique.length; i += 1) {
    if (daysBetween(unique[i]!, unique[i - 1]!) !== 1) break;
    streak += 1;
  }

  return streak;
}

/** «1 день», «2 дня», «5 дней» — русский счёт, а не «1 дней». */
export function daysWord(count: number): string {
  const mod100 = Math.abs(count) % 100;
  const mod10 = mod100 % 10;

  if (mod100 >= 11 && mod100 <= 14) return 'дней';
  if (mod10 === 1) return 'день';
  if (mod10 >= 2 && mod10 <= 4) return 'дня';
  return 'дней';
}
