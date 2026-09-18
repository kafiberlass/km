/**
 * Сбор и восстановление резервной копии. Формат — в core/backup/format.ts.
 */

import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  type BackupData,
  type CellTuple,
  type DiscoveryTuple,
  type AchievementTuple,
  type PointTuple,
  type BackupSession,
} from '@/core/backup/format';

import { getRawDb } from './client';
import { getProfile } from './repo';

export function collectBackup(now: number = Date.now()): BackupData {
  const db = getRawDb();
  const profile = getProfile();

  const sessions = (
    db.executeSync(
      `SELECT id, started_at, ended_at, distance_m, duration_s, new_cells, source, is_night
       FROM walk_sessions ORDER BY started_at`,
    ).rows as Record<string, unknown>[]
  ).map<BackupSession>((row) => ({
    id: String(row.id),
    startedAt: Number(row.started_at),
    endedAt: row.ended_at == null ? null : Number(row.ended_at),
    distanceM: Number(row.distance_m),
    durationS: Number(row.duration_s),
    newCells: Number(row.new_cells),
    source: String(row.source),
    isNight: Number(row.is_night) === 1,
  }));

  const points = (
    db.executeSync(
      `SELECT session_id, segment, lat, lng, accuracy, recorded_at
       FROM track_points ORDER BY session_id, segment, recorded_at`,
    ).rows as Record<string, unknown>[]
  ).map<PointTuple>((row) => [
    String(row.session_id),
    Number(row.segment),
    Number(row.lat),
    Number(row.lng),
    Number(row.accuracy),
    Number(row.recorded_at),
  ]);

  const cells = (
    db.executeSync('SELECT h3, parent, first_seen_at, session_id FROM explored_cells')
      .rows as Record<string, unknown>[]
  ).map<CellTuple>((row) => [
    String(row.h3),
    String(row.parent),
    Number(row.first_seen_at),
    row.session_id == null ? null : String(row.session_id),
  ]);

  const achievements = (
    db.executeSync('SELECT code, unlocked_at FROM user_achievements').rows as Record<
      string,
      unknown
    >[]
  ).map<AchievementTuple>((row) => [String(row.code), Number(row.unlocked_at)]);

  const discoveries = (
    db.executeSync('SELECT place_id, discovered_at FROM place_discoveries').rows as Record<
      string,
      unknown
    >[]
  ).map<DiscoveryTuple>((row) => [String(row.place_id), Number(row.discovered_at)]);

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: now,
    profile: {
      displayName: profile.displayName,
      avatar: profile.avatar,
      level: profile.level,
      xp: profile.xp,
      streakDays: profile.streakDays,
      bestStreak: profile.bestStreak,
      lastActiveDate: profile.lastActiveDate,
      timeZone: profile.timeZone,
      originLat: profile.originLat,
      originLng: profile.originLng,
    },
    sessions,
    points,
    cells,
    achievements,
    discoveries,
  };
}

/**
 * Восстановление. Заменяет всё, а не дополняет.
 *
 * Слияние двух историй звучит красиво, но на деле означает дубли точек,
 * задвоенные километры и разъехавшийся опыт. Копия — это «вернуть как было»,
 * и человек предупреждён об этом до нажатия.
 *
 * Одной транзакцией: оборваться на середине и оставить половину чужой,
 * половину своей истории — худшее, что может случиться с этой кнопкой.
 */
export function restoreBackup(data: BackupData): void {
  const db = getRawDb();

  db.executeSync('BEGIN');
  try {
    for (const table of [
      'track_points',
      'explored_cells',
      'walk_sessions',
      'place_discoveries',
      'user_achievements',
      'xp_events',
    ]) {
      db.executeSync(`DELETE FROM ${table}`);
    }

    const p = data.profile;
    db.executeSync(
      `UPDATE profile SET display_name = ?, avatar = ?, level = ?, xp = ?, streak_days = ?,
         best_streak = ?, last_active_date = ?, time_zone = ?, origin_lat = ?, origin_lng = ?,
         updated_at = ?
       WHERE id = 1`,
      [
        p.displayName,
        p.avatar,
        p.level,
        p.xp,
        p.streakDays,
        p.bestStreak,
        p.lastActiveDate,
        p.timeZone,
        p.originLat,
        p.originLng,
        Date.now(),
      ],
    );

    for (const s of data.sessions) {
      db.executeSync(
        `INSERT OR REPLACE INTO walk_sessions
           (id, started_at, ended_at, distance_m, duration_s, new_cells, source, is_night, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [s.id, s.startedAt, s.endedAt, s.distanceM, s.durationS, s.newCells, s.source, s.isNight ? 1 : 0, Date.now()],
      );
    }

    for (const [sessionId, segment, lat, lng, accuracy, recordedAt] of data.points) {
      db.executeSync(
        `INSERT INTO track_points (session_id, segment, lat, lng, accuracy, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [sessionId, segment, lat, lng, accuracy, recordedAt],
      );
    }

    for (const [h3, parent, firstSeenAt, sessionId] of data.cells) {
      db.executeSync(
        `INSERT OR REPLACE INTO explored_cells (h3, parent, first_seen_at, session_id)
         VALUES (?, ?, ?, ?)`,
        [h3, parent, firstSeenAt, sessionId],
      );
    }

    for (const [code, unlockedAt] of data.achievements) {
      db.executeSync(
        'INSERT OR REPLACE INTO user_achievements (code, unlocked_at) VALUES (?, ?)',
        [code, unlockedAt],
      );
    }

    for (const [placeId, discoveredAt] of data.discoveries) {
      db.executeSync(
        'INSERT OR REPLACE INTO place_discoveries (place_id, discovered_at) VALUES (?, ?)',
        [placeId, discoveredAt],
      );
    }

    db.executeSync('COMMIT');
  } catch (error) {
    db.executeSync('ROLLBACK');
    throw error;
  }
}
