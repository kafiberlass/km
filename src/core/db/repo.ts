/**
 * Доступ к данным. Горячие пути идут сырым SQL через op-sqlite —
 * вставка нескольких тысяч ячеек за прогулку должна укладываться
 * в одну транзакцию, а не в тысячи вызовов ORM.
 */

import { getRawDb } from './client';
import { PARENT_RES, parentOf, type Cell } from '../geo/coverage';
import type { GeoPoint } from '../geo/filter';
import type { ProgressSnapshot } from '../rules/achievements';

export interface ProfileRow {
  level: number;
  xp: number;
  streakDays: number;
  bestStreak: number;
  lastActiveDate: string | null;
  timeZone: string;
  originLat: number | null;
  originLng: number | null;
  homeRegionId: string | null;
}

function row<T>(result: { rows: unknown[] }): T | null {
  return (result.rows[0] as T) ?? null;
}

export function getProfile(): ProfileRow {
  const db = getRawDb();
  const res = db.executeSync('SELECT * FROM profile WHERE id = 1');
  const raw = row<Record<string, unknown>>(res);
  return {
    level: Number(raw?.level ?? 1),
    xp: Number(raw?.xp ?? 0),
    streakDays: Number(raw?.streak_days ?? 0),
    bestStreak: Number(raw?.best_streak ?? 0),
    lastActiveDate: (raw?.last_active_date as string | null) ?? null,
    timeZone: (raw?.time_zone as string) ?? 'UTC',
    originLat: raw?.origin_lat == null ? null : Number(raw.origin_lat),
    originLng: raw?.origin_lng == null ? null : Number(raw.origin_lng),
    homeRegionId: (raw?.home_region_id as string | null) ?? null,
  };
}

export function updateProfile(patch: Partial<ProfileRow>): void {
  const db = getRawDb();
  const columns: Record<keyof ProfileRow, string> = {
    level: 'level',
    xp: 'xp',
    streakDays: 'streak_days',
    bestStreak: 'best_streak',
    lastActiveDate: 'last_active_date',
    timeZone: 'time_zone',
    originLat: 'origin_lat',
    originLng: 'origin_lng',
    homeRegionId: 'home_region_id',
  };

  const sets: string[] = [];
  const values: (string | number | null)[] = [];
  for (const [key, column] of Object.entries(columns)) {
    const value = patch[key as keyof ProfileRow];
    if (value === undefined) continue;
    sets.push(`${column} = ?`);
    values.push(value as string | number | null);
  }
  if (sets.length === 0) return;

  sets.push('updated_at = ?');
  values.push(Date.now());
  db.executeSync(`UPDATE profile SET ${sets.join(', ')} WHERE id = 1`, values);
}

/**
 * Origin проектора фиксируется один раз — первой точкой пользователя.
 * Менять его потом нельзя: вся сохранённая геометрия тумана к нему привязана.
 */
export function ensureOrigin(point: { lat: number; lng: number }): { lat: number; lng: number } {
  const profile = getProfile();
  if (profile.originLat != null && profile.originLng != null) {
    return { lat: profile.originLat, lng: profile.originLng };
  }
  updateProfile({ originLat: point.lat, originLng: point.lng });
  return { lat: point.lat, lng: point.lng };
}

export function createSession(id: string, startedAt: number, source: string, isNight: boolean): void {
  getRawDb().executeSync(
    `INSERT INTO walk_sessions (id, started_at, source, is_night, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, startedAt, source, isNight ? 1 : 0, Date.now()],
  );
}

export function finishSession(
  id: string,
  patch: { endedAt: number; distanceM: number; durationS: number; newCells: number },
): void {
  getRawDb().executeSync(
    `UPDATE walk_sessions
     SET ended_at = ?, distance_m = ?, duration_s = ?, new_cells = ?, updated_at = ?
     WHERE id = ?`,
    [patch.endedAt, patch.distanceM, patch.durationS, patch.newCells, Date.now(), id],
  );
}

/** Ночная прогулка определяется по первой валидной точке — см. core/geo/sun.ts. */
export function markSessionNight(sessionId: string): void {
  getRawDb().executeSync('UPDATE walk_sessions SET is_night = 1 WHERE id = ?', [sessionId]);
}

export function insertPoints(sessionId: string, segment: number, points: GeoPoint[]): void {
  if (points.length === 0) return;
  const db = getRawDb();
  db.executeSync('BEGIN');
  try {
    for (const p of points) {
      db.executeSync(
        `INSERT INTO track_points
           (session_id, segment, lat, lng, accuracy, speed, heading, altitude, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sessionId,
          segment,
          p.lat,
          p.lng,
          p.accuracy,
          p.speed ?? null,
          p.heading ?? null,
          p.altitude ?? null,
          p.timestamp,
        ],
      );
    }
    db.executeSync('COMMIT');
  } catch (error) {
    db.executeSync('ROLLBACK');
    throw error;
  }
}

/**
 * Вставка открытых ячеек. Возвращает количество ДЕЙСТВИТЕЛЬНО новых —
 * от него считается XP, поэтому повторный проход по своей же улице
 * не должен ничего начислять.
 */
export function insertCells(cells: Cell[], sessionId: string | null, at: number): number {
  if (cells.length === 0) return 0;
  const db = getRawDb();
  const before = countCells();

  db.executeSync('BEGIN');
  try {
    for (const cell of cells) {
      db.executeSync(
        `INSERT OR IGNORE INTO explored_cells (h3, parent, first_seen_at, session_id)
         VALUES (?, ?, ?, ?)`,
        [cell, parentOf(cell, PARENT_RES), at, sessionId],
      );
    }
    db.executeSync('COMMIT');
  } catch (error) {
    db.executeSync('ROLLBACK');
    throw error;
  }

  return countCells() - before;
}

export function countCells(): number {
  const res = getRawDb().executeSync('SELECT COUNT(*) AS n FROM explored_cells');
  return Number((res.rows[0] as { n: number } | undefined)?.n ?? 0);
}

export function listCellsByParents(parents: string[]): Cell[] {
  if (parents.length === 0) return [];
  const placeholders = parents.map(() => '?').join(',');
  const res = getRawDb().executeSync(
    `SELECT h3 FROM explored_cells WHERE parent IN (${placeholders})`,
    parents,
  );
  return (res.rows as { h3: string }[]).map((r) => r.h3);
}

export interface TrackSegment {
  sessionId: string;
  segment: number;
  points: { lat: number; lng: number }[];
}

/**
 * Геометрия для Skia-слоя. Лимит стоит сознательно: скелет должен уметь
 * показать, на каком объёме истории начинает проседать рендер.
 */
export function loadTrackSegments(limitPoints = 200_000): TrackSegment[] {
  const res = getRawDb().executeSync(
    `SELECT session_id, segment, lat, lng
     FROM track_points
     ORDER BY session_id, segment, recorded_at
     LIMIT ?`,
    [limitPoints],
  );

  const segments: TrackSegment[] = [];
  let current: TrackSegment | null = null;

  for (const raw of res.rows as { session_id: string; segment: number; lat: number; lng: number }[]) {
    if (!current || current.sessionId !== raw.session_id || current.segment !== raw.segment) {
      current = { sessionId: raw.session_id, segment: raw.segment, points: [] };
      segments.push(current);
    }
    current.points.push({ lat: raw.lat, lng: raw.lng });
  }

  return segments;
}

export function appendXpEvent(
  kind: string,
  amount: number,
  ref: string | null,
  sessionId: string | null,
): void {
  getRawDb().executeSync(
    `INSERT INTO xp_events (kind, amount, ref, session_id, created_at) VALUES (?, ?, ?, ?, ?)`,
    [kind, amount, ref, sessionId, Date.now()],
  );
}

export function unlockedAchievements(): Set<string> {
  const res = getRawDb().executeSync('SELECT code FROM user_achievements');
  return new Set((res.rows as { code: string }[]).map((r) => r.code));
}

export function unlockAchievement(code: string, at: number): void {
  getRawDb().executeSync(
    'INSERT OR IGNORE INTO user_achievements (code, unlocked_at) VALUES (?, ?)',
    [code, at],
  );
}

export interface PlaceRow {
  id: string;
  lat: number;
  lng: number;
  type: string;
  title: string;
  subtitle: string | null;
  radiusM: number;
  xpReward: number;
  discoveredAt: number | null;
}

export function upsertPlaces(rows: Omit<PlaceRow, 'discoveredAt'>[]): void {
  const db = getRawDb();
  db.executeSync('BEGIN');
  try {
    for (const p of rows) {
      db.executeSync(
        `INSERT INTO places (id, lat, lng, type, title, subtitle, radius_m, xp_reward)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           lat = excluded.lat, lng = excluded.lng, type = excluded.type,
           title = excluded.title, subtitle = excluded.subtitle,
           radius_m = excluded.radius_m, xp_reward = excluded.xp_reward`,
        [p.id, p.lat, p.lng, p.type, p.title, p.subtitle, p.radiusM, p.xpReward],
      );
    }
    db.executeSync('COMMIT');
  } catch (error) {
    db.executeSync('ROLLBACK');
    throw error;
  }
}

/** Грубая выборка по bbox — R-tree для скелета избыточен. */
export function placesInBox(
  minLat: number,
  minLng: number,
  maxLat: number,
  maxLng: number,
): PlaceRow[] {
  const res = getRawDb().executeSync(
    `SELECT p.*, d.discovered_at
     FROM places p
     LEFT JOIN place_discoveries d ON d.place_id = p.id
     WHERE p.lat BETWEEN ? AND ? AND p.lng BETWEEN ? AND ?`,
    [minLat, maxLat, minLng, maxLng],
  );
  return (res.rows as Record<string, unknown>[]).map(mapPlace);
}

export function allPlaces(): PlaceRow[] {
  const res = getRawDb().executeSync(
    `SELECT p.*, d.discovered_at
     FROM places p
     LEFT JOIN place_discoveries d ON d.place_id = p.id
     ORDER BY p.title`,
  );
  return (res.rows as Record<string, unknown>[]).map(mapPlace);
}

function mapPlace(raw: Record<string, unknown>): PlaceRow {
  return {
    id: String(raw.id),
    lat: Number(raw.lat),
    lng: Number(raw.lng),
    type: String(raw.type),
    title: String(raw.title),
    subtitle: (raw.subtitle as string | null) ?? null,
    radiusM: Number(raw.radius_m),
    xpReward: Number(raw.xp_reward),
    discoveredAt: raw.discovered_at == null ? null : Number(raw.discovered_at),
  };
}

export function discoverPlace(placeId: string, at: number, sessionId: string | null): boolean {
  const res = getRawDb().executeSync(
    'INSERT OR IGNORE INTO place_discoveries (place_id, discovered_at, session_id) VALUES (?, ?, ?)',
    [placeId, at, sessionId],
  );
  return (res.rowsAffected ?? 0) > 0;
}

/** Снимок для правил ачивок. Один запрос на агрегат — вызывается редко. */
export function buildSnapshot(homeRegionTotalCells: number): ProgressSnapshot {
  const db = getRawDb();
  const stats = row<Record<string, unknown>>(
    db.executeSync(
      `SELECT
         COALESCE(SUM(distance_m), 0) AS total_distance,
         COUNT(*)                     AS total_walks,
         COALESCE(MAX(distance_m), 0) AS longest,
         COALESCE(SUM(is_night), 0)   AS night_walks
       FROM walk_sessions
       WHERE ended_at IS NOT NULL AND source != 'mock'`,
    ),
  );

  const activeDays = row<{ n: number }>(
    db.executeSync(
      `SELECT COUNT(DISTINCT date(started_at / 1000, 'unixepoch')) AS n
       FROM walk_sessions WHERE source != 'mock'`,
    ),
  );

  const placesFound = row<{ n: number }>(
    db.executeSync('SELECT COUNT(*) AS n FROM place_discoveries'),
  );

  const profile = getProfile();
  const cells = countCells();

  return {
    totalDistanceM: Number(stats?.total_distance ?? 0),
    totalWalks: Number(stats?.total_walks ?? 0),
    exploredCells: cells,
    discoveredPlaces: Number(placesFound?.n ?? 0),
    currentStreakDays: profile.streakDays,
    bestStreakDays: profile.bestStreak,
    nightWalks: Number(stats?.night_walks ?? 0),
    longestWalkM: Number(stats?.longest ?? 0),
    homeRegionRatio: homeRegionTotalCells > 0 ? cells / homeRegionTotalCells : 0,
    activeDays: Number(activeDays?.n ?? 0),
  };
}
