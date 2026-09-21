/**
 * Неделя: кто сколько прошёл.
 *
 * Смысл не в том, чтобы кого-то обогнать, а в том, чтобы видеть друг
 * друга. Поэтому здесь нет ни призов, ни «вы на последнем месте»:
 * просто числа рядом, и каждому видно, что остальные тоже ходят.
 *
 * Данные приходят с сервера и по определению бывают несвежими: телефон
 * друга мог не выходить в сеть два дня. Такие строки помечаются, а не
 * прячутся — «давно не обновлялось» честнее, чем ноль.
 */

/** Насколько старым может быть число, чтобы всё ещё считаться сегодняшним. */
export const WEEK_FRESH_MS = 36 * 60 * 60 * 1000;

export interface BoardPerson {
  id: string;
  name: string;
  avatar: string | null;
  color: string;
  /** Сколько метров за последние семь дней. null — человек ещё не делился. */
  weekM: number | null;
  /** Когда это число посчитали на его телефоне. */
  weekAt: number | null;
}

export interface BoardRow extends BoardPerson {
  isMe: boolean;
  /** Доля от лучшего результата — ширина полоски, 0..1. */
  share: number;
  /** Число устарело: телефон давно не выходил на связь. */
  stale: boolean;
  /** Место в списке, начиная с единицы. */
  place: number;
}

export function buildBoard(
  me: BoardPerson,
  friends: readonly BoardPerson[],
  now: number = Date.now(),
): BoardRow[] {
  const people = [
    { person: me, isMe: true },
    ...friends.map((person) => ({ person, isMe: false })),
  ];

  const best = people.reduce((max, { person }) => Math.max(max, person.weekM ?? 0), 0);

  return people
    .sort((a, b) => {
      const diff = (b.person.weekM ?? -1) - (a.person.weekM ?? -1);
      if (diff !== 0) return diff;
      // При равенстве — по имени, чтобы порядок не прыгал между обновлениями.
      return a.person.name.localeCompare(b.person.name, 'ru');
    })
    .map(({ person, isMe }, index) => ({
      ...person,
      isMe,
      place: index + 1,
      share: best > 0 ? Math.min(1, (person.weekM ?? 0) / best) : 0,
      stale:
        person.weekM != null &&
        !isMe &&
        (person.weekAt == null || now - person.weekAt > WEEK_FRESH_MS),
    }));
}

/** «3,4 км» — то же правило, что и в истории прогулок. */
export function formatWeekDistance(meters: number | null): string {
  if (meters == null) return '—';
  if (meters < 1000) return `${Math.round(meters / 10) * 10} м`;
  return `${(meters / 1000).toFixed(1)} км`;
}
