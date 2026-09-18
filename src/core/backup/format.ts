/**
 * Формат резервной копии.
 *
 * Вся карта человека живёт только в телефоне: потерял телефон — потерял
 * год ходьбы. Копия — обычный файл, который можно положить куда угодно
 * и восстановить на новом телефоне.
 *
 * Здесь только формат и его проверка, без базы и файлов: разбор чужого
 * файла обязан быть надёжным, а надёжность проверяется тестами.
 *
 * Точки и клетки хранятся кортежами, а не объектами: в них весь объём,
 * и подписи полей на каждой из десятков тысяч строк утраивают размер файла.
 */

export const BACKUP_FORMAT = 'km-backup';
export const BACKUP_VERSION = 1;

/** [sessionId, segment, lat, lng, accuracy, timestamp] */
export type PointTuple = [string, number, number, number, number, number];
/** [h3, parent, firstSeenAt, sessionId | null] */
export type CellTuple = [string, string, number, string | null];
/** [code, unlockedAt] */
export type AchievementTuple = [string, number];
/** [placeId, discoveredAt] */
export type DiscoveryTuple = [string, number];

export interface BackupProfile {
  displayName: string | null;
  avatar: string | null;
  level: number;
  xp: number;
  streakDays: number;
  bestStreak: number;
  lastActiveDate: string | null;
  timeZone: string;
  originLat: number | null;
  originLng: number | null;
}

export interface BackupSession {
  id: string;
  startedAt: number;
  endedAt: number | null;
  distanceM: number;
  durationS: number;
  newCells: number;
  source: string;
  isNight: boolean;
}

export interface BackupData {
  format: typeof BACKUP_FORMAT;
  version: number;
  createdAt: number;
  profile: BackupProfile;
  sessions: BackupSession[];
  points: PointTuple[];
  cells: CellTuple[];
  achievements: AchievementTuple[];
  discoveries: DiscoveryTuple[];
}

/** Что показать человеку до восстановления: что именно он собирается вернуть. */
export interface BackupSummary {
  createdAt: number;
  walks: number;
  cells: number;
  points: number;
  level: number;
}

export function summarize(data: BackupData): BackupSummary {
  return {
    createdAt: data.createdAt,
    walks: data.sessions.length,
    cells: data.cells.length,
    points: data.points.length,
    level: data.profile.level,
  };
}

export type ParseResult =
  | { status: 'ok'; data: BackupData }
  | { status: 'not-json' }
  | { status: 'not-backup' }
  /** Файл новее приложения: у него другой формат, и угадывать мы не будем. */
  | { status: 'too-new'; version: number };

export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { status: 'not-json' };
  }

  if (typeof raw !== 'object' || raw === null) return { status: 'not-backup' };
  const candidate = raw as Partial<BackupData>;

  if (candidate.format !== BACKUP_FORMAT) return { status: 'not-backup' };
  if (typeof candidate.version !== 'number') return { status: 'not-backup' };
  if (candidate.version > BACKUP_VERSION) return { status: 'too-new', version: candidate.version };

  const profile = candidate.profile;
  if (typeof profile !== 'object' || profile === null) return { status: 'not-backup' };

  // Дальше — не доверяем ничему: файл мог быть обрезан на середине копирования.
  const data: BackupData = {
    format: BACKUP_FORMAT,
    version: candidate.version,
    createdAt: typeof candidate.createdAt === 'number' ? candidate.createdAt : Date.now(),
    profile: {
      displayName: typeof profile.displayName === 'string' ? profile.displayName : null,
      avatar: typeof profile.avatar === 'string' ? profile.avatar : null,
      level: numberOr(profile.level, 1),
      xp: numberOr(profile.xp, 0),
      streakDays: numberOr(profile.streakDays, 0),
      bestStreak: numberOr(profile.bestStreak, 0),
      lastActiveDate: typeof profile.lastActiveDate === 'string' ? profile.lastActiveDate : null,
      timeZone: typeof profile.timeZone === 'string' ? profile.timeZone : 'UTC',
      originLat: typeof profile.originLat === 'number' ? profile.originLat : null,
      originLng: typeof profile.originLng === 'number' ? profile.originLng : null,
    },
    sessions: Array.isArray(candidate.sessions) ? candidate.sessions.filter(isSession) : [],
    points: Array.isArray(candidate.points) ? candidate.points.filter(isPoint) : [],
    cells: Array.isArray(candidate.cells) ? candidate.cells.filter(isCell) : [],
    achievements: Array.isArray(candidate.achievements)
      ? candidate.achievements.filter(isPair)
      : [],
    discoveries: Array.isArray(candidate.discoveries) ? candidate.discoveries.filter(isPair) : [],
  };

  return { status: 'ok', data };
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function isSession(value: unknown): value is BackupSession {
  const row = value as Partial<BackupSession> | null;
  return (
    typeof row === 'object' &&
    row !== null &&
    typeof row.id === 'string' &&
    typeof row.startedAt === 'number'
  );
}

function isPoint(value: unknown): value is PointTuple {
  return (
    Array.isArray(value) &&
    value.length === 6 &&
    typeof value[0] === 'string' &&
    value.slice(1).every((item) => typeof item === 'number' && Number.isFinite(item))
  );
}

function isCell(value: unknown): value is CellTuple {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    typeof value[0] === 'string' &&
    typeof value[1] === 'string' &&
    typeof value[2] === 'number'
  );
}

function isPair(value: unknown): value is AchievementTuple {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === 'string' &&
    typeof value[1] === 'number'
  );
}

/** Имя файла с датой: в списке файлов их будет несколько. */
export function backupFileName(now: number = Date.now()): string {
  const date = new Date(now).toISOString().slice(0, 10);
  return `km-${date}.json`;
}
