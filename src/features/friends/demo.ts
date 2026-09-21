/**
 * Демо-таблица лидеров.
 *
 * Бэкенда нет — значит, и друзей нет. Это фикстура того же сорта, что
 * demo-места в features/places/seed.ts: она показывает, как экран выглядит
 * с данными, и держит вёрстку. Экран помечает её чипом «ДЕМО», чтобы никто
 * не принял цифры за настоящие.
 *
 * Чтобы это заработало по-настоящему, нужны три вещи, которых в скелете нет:
 * аккаунты, сервер и серверная валидация XP. Без последней таблицу накрутят
 * за вечер — координаты подделываются тем же Lockito, которым мы тестируем
 * геолокацию. Правила из src/core/rules/ писались без импортов из React
 * именно ради такого переезда на сервер.
 */

export interface FriendRow {
  id: string;
  name: string;
  /** Пройдено за выбранный период. */
  distanceM: number;
  /** Доля открытого домашнего района, 0..1. */
  coverageRatio: number;
  xp: number;
  /** Строка самого пользователя — подсвечивается кольцом. */
  isYou?: boolean;
}

export const DEMO_FRIENDS: readonly FriendRow[] = [
  { id: 'demo-friend-1', name: 'Марина', distanceM: 41_200, coverageRatio: 0.078, xp: 1240 },
  { id: 'demo-friend-2', name: 'Дима', distanceM: 38_600, coverageRatio: 0.051, xp: 1090 },
  { id: 'demo-friend-3', name: 'Аня', distanceM: 27_000, coverageRatio: 0.042, xp: 870 },
  { id: 'demo-friend-4', name: 'Костя', distanceM: 19_800, coverageRatio: 0.026, xp: 640 },
  { id: 'demo-friend-5', name: 'Лев', distanceM: 12_300, coverageRatio: 0.019, xp: 430 },
] as const;

/** Общие ячейки с лидером — заглушка под будущий серверный пересчёт. */
export const DEMO_SHARED_CELLS = 214;

/** Вставляет строку пользователя в демо-список и расставляет места по XP. */
export function buildLeaderboard(you: Omit<FriendRow, 'id' | 'isYou'>): FriendRow[] {
  return [...DEMO_FRIENDS, { ...you, id: 'you', isYou: true }].sort((a, b) => b.xp - a.xp);
}
