/**
 * Сводка по прогулкам: итоги и группировка по дням.
 *
 * Данные о прогулках копятся с первого дня, но показать их было негде.
 * Считается всё чистыми функциями от списка строк — чтобы проверять
 * тестами, а не глазами по экрану через месяц ходьбы.
 */

import { localDateKey } from '@/core/rules/streak';

export interface WalkRow {
  id: string;
  startedAt: number;
  endedAt: number | null;
  distanceM: number;
  durationS: number;
  newCells: number;
  isNight: boolean;
}

export interface Totals {
  walks: number;
  distanceM: number;
  durationS: number;
  newCells: number;
}

export const EMPTY_TOTALS: Totals = { walks: 0, distanceM: 0, durationS: 0, newCells: 0 };

export function totalsOf(rows: readonly WalkRow[]): Totals {
  return rows.reduce<Totals>(
    (sum, row) => ({
      walks: sum.walks + 1,
      distanceM: sum.distanceM + row.distanceM,
      durationS: sum.durationS + row.durationS,
      newCells: sum.newCells + row.newCells,
    }),
    EMPTY_TOTALS,
  );
}

/** Итоги за последние `days` суток — «за неделю», «за месяц». */
export function totalsSince(rows: readonly WalkRow[], days: number, now: number): Totals {
  const from = now - days * 24 * 60 * 60 * 1000;
  return totalsOf(rows.filter((row) => row.startedAt >= from));
}

export interface DayGroup {
  /** YYYY-MM-DD в часовом поясе человека. */
  dateKey: string;
  rows: WalkRow[];
  totals: Totals;
}

/**
 * Прогулки по дням, свежие сверху.
 *
 * Именно по местным суткам, а не по UTC: прогулка в час ночи по Казани
 * приходится на предыдущий день по Гринвичу, и в списке она оказалась бы
 * «вчера», хотя человек вернулся с неё десять минут назад.
 */
export function groupByDay(rows: readonly WalkRow[], timeZone: string): DayGroup[] {
  const groups = new Map<string, WalkRow[]>();

  for (const row of rows) {
    const key = localDateKey(row.startedAt, timeZone);
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }

  return [...groups.entries()]
    .map(([dateKey, dayRows]) => ({
      dateKey,
      rows: [...dayRows].sort((a, b) => b.startedAt - a.startedAt),
      totals: totalsOf(dayRows),
    }))
    .sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1));
}

/** «1 ч 20 мин» — часы появляются только когда они есть. */
export function formatDuration(durationS: number): string {
  const minutes = Math.max(0, Math.round(durationS / 60));
  if (minutes < 60) return `${minutes} мин`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} ч` : `${hours} ч ${rest} мин`;
}

/** Метры в километры с одним знаком, но без «0.0 км» для коротких прогулок. */
export function formatDistance(distanceM: number): string {
  if (distanceM < 1000) return `${Math.round(distanceM / 10) * 10} м`;
  return `${(distanceM / 1000).toFixed(1)} км`;
}
