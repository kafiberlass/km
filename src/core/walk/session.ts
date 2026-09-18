/**
 * Активная прогулка, пережившая выгрузку приложения.
 *
 * iOS не спрашивает разрешения: он может убить приложение в любой момент
 * и поднять его заново только ради пачки координат. Если единственным
 * следом идущей прогулки остаётся состояние в памяти, после такого
 * пробуждения приложение считает, что никто никуда не идёт, и молча
 * выбрасывает всё, что человек прошёл.
 *
 * Поэтому факт «прогулка идёт» лежит в базе. Здесь — только разбор
 * и проверка записи, без единого обращения к SQLite: чистое гоняет vitest
 * без эмулятора. Чтение и запись живут в core/db/activeWalk.ts.
 */

/**
 * Сколько прогулка может висеть незакрытой.
 *
 * Человек мог забыть нажать «завершить» и уехать спать: продолжать такую
 * прогулку через сутки бессмысленно — между точками будет ночь. Но и молча
 * терять её нельзя, поэтому просроченная сессия не выбрасывается,
 * а доводится до конца обычным способом, с начислением опыта.
 */
export const MAX_WALK_AGE_MS = 12 * 60 * 60 * 1000;

export interface ActiveWalk {
  sessionId: string;
  startedAt: number;
  source: string;
}

export function serializeActiveWalk(walk: ActiveWalk): string {
  return JSON.stringify(walk);
}

/** Возвращает null на любом мусоре: запись делает программа, но читает её ОС-пробуждение. */
export function parseActiveWalk(raw: string | null): ActiveWalk | null {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;
  const candidate = parsed as Partial<ActiveWalk>;

  if (typeof candidate.sessionId !== 'string' || candidate.sessionId.length === 0) return null;
  if (typeof candidate.startedAt !== 'number' || !Number.isFinite(candidate.startedAt)) return null;

  return {
    sessionId: candidate.sessionId,
    startedAt: candidate.startedAt,
    source: typeof candidate.source === 'string' ? candidate.source : 'device',
  };
}

/** Можно ли ещё продолжать эту прогулку, или её пора закрывать. */
export function isWalkResumable(walk: ActiveWalk, now: number = Date.now()): boolean {
  const age = now - walk.startedAt;
  // Отрицательный возраст — часы телефона перевели назад. Доверять такой
  // записи нельзя, но и выбрасывать пройденное незачем: закрываем прогулку.
  return age >= 0 && age <= MAX_WALK_AGE_MS;
}
