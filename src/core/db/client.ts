/**
 * Открытие БД и миграции.
 *
 * Схема поднимается сырым SQL, а не drizzle-kit: генератор миграций требует
 * отдельного пайплайна, а на старте важнее, чтобы приложение поднималось
 * с нуля одной функцией. Когда схема устаканится — переключить на drizzle-kit.
 */

import { open, type DB } from '@op-engineering/op-sqlite';
import { drizzle } from 'drizzle-orm/op-sqlite';

import * as schema from './schema';

const DB_NAME = 'km.sqlite';

const MIGRATIONS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS profile (
     id INTEGER PRIMARY KEY,
     level INTEGER NOT NULL DEFAULT 1,
     xp INTEGER NOT NULL DEFAULT 0,
     streak_days INTEGER NOT NULL DEFAULT 0,
     best_streak INTEGER NOT NULL DEFAULT 0,
     last_active_date TEXT,
     time_zone TEXT NOT NULL DEFAULT 'UTC',
     origin_lat REAL,
     origin_lng REAL,
     home_region_id TEXT,
     updated_at INTEGER NOT NULL DEFAULT 0,
     synced_at INTEGER
   );`,
  `CREATE TABLE IF NOT EXISTS walk_sessions (
     id TEXT PRIMARY KEY,
     started_at INTEGER NOT NULL,
     ended_at INTEGER,
     distance_m REAL NOT NULL DEFAULT 0,
     duration_s INTEGER NOT NULL DEFAULT 0,
     new_cells INTEGER NOT NULL DEFAULT 0,
     source TEXT NOT NULL DEFAULT 'device',
     is_night INTEGER NOT NULL DEFAULT 0,
     updated_at INTEGER NOT NULL DEFAULT 0,
     synced_at INTEGER
   );`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_started ON walk_sessions (started_at);`,
  `CREATE TABLE IF NOT EXISTS track_points (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     session_id TEXT NOT NULL,
     segment INTEGER NOT NULL DEFAULT 0,
     lat REAL NOT NULL,
     lng REAL NOT NULL,
     accuracy REAL NOT NULL,
     speed REAL,
     heading REAL,
     altitude REAL,
     recorded_at INTEGER NOT NULL
   );`,
  `CREATE INDEX IF NOT EXISTS idx_points_session
     ON track_points (session_id, segment, recorded_at);`,
  `CREATE TABLE IF NOT EXISTS explored_cells (
     h3 TEXT PRIMARY KEY,
     parent TEXT NOT NULL,
     first_seen_at INTEGER NOT NULL,
     session_id TEXT,
     synced_at INTEGER
   );`,
  `CREATE INDEX IF NOT EXISTS idx_cells_parent ON explored_cells (parent);`,
  `CREATE TABLE IF NOT EXISTS places (
     id TEXT PRIMARY KEY,
     lat REAL NOT NULL,
     lng REAL NOT NULL,
     type TEXT NOT NULL,
     title TEXT NOT NULL,
     subtitle TEXT,
     radius_m REAL NOT NULL DEFAULT 80,
     xp_reward INTEGER NOT NULL DEFAULT 50
   );`,
  `CREATE INDEX IF NOT EXISTS idx_places_bbox ON places (lat, lng);`,
  `CREATE TABLE IF NOT EXISTS place_discoveries (
     place_id TEXT PRIMARY KEY,
     discovered_at INTEGER NOT NULL,
     session_id TEXT,
     synced_at INTEGER
   );`,
  `CREATE TABLE IF NOT EXISTS user_achievements (
     code TEXT PRIMARY KEY,
     unlocked_at INTEGER NOT NULL,
     synced_at INTEGER
   );`,
  `CREATE TABLE IF NOT EXISTS xp_events (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     kind TEXT NOT NULL,
     amount INTEGER NOT NULL,
     ref TEXT,
     session_id TEXT,
     created_at INTEGER NOT NULL,
     synced_at INTEGER
   );`,
  `CREATE INDEX IF NOT EXISTS idx_xp_created ON xp_events (created_at);`,
  `CREATE TABLE IF NOT EXISTS outbox (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     entity TEXT NOT NULL,
     entity_id TEXT NOT NULL,
     op TEXT NOT NULL,
     payload TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     attempts INTEGER NOT NULL DEFAULT 0
   );`,
  `CREATE INDEX IF NOT EXISTS idx_outbox_created ON outbox (created_at);`,
  `CREATE TABLE IF NOT EXISTS regions (
     id TEXT PRIMARY KEY,
     title TEXT NOT NULL,
     boundary TEXT NOT NULL,
     total_cells INTEGER NOT NULL
   );`,
  `CREATE TABLE IF NOT EXISTS region_cells (
     region_id TEXT NOT NULL,
     parent TEXT NOT NULL,
     cell_count INTEGER NOT NULL,
     PRIMARY KEY (region_id, parent)
   );`,
  `INSERT OR IGNORE INTO profile (id) VALUES (1);`,
];

let rawDb: DB | null = null;
let ormDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getRawDb(): DB {
  if (!rawDb) {
    rawDb = open({ name: DB_NAME });
    // WAL — обязательно: запись точек идёт пачками во время чтения карты.
    rawDb.executeSync('PRAGMA journal_mode = WAL;');
    rawDb.executeSync('PRAGMA synchronous = NORMAL;');
    rawDb.executeSync('PRAGMA foreign_keys = ON;');
  }
  return rawDb;
}

export function getDb() {
  if (!ormDb) {
    ormDb = drizzle(getRawDb(), { schema });
  }
  return ormDb;
}

/**
 * Колонки, добавленные к уже существующим таблицам.
 *
 * Отдельно от MIGRATIONS, потому что миграции выполняются при каждом
 * запуске и обязаны быть идемпотентными, а `ALTER TABLE ADD COLUMN`
 * в SQLite не умеет `IF NOT EXISTS` и на втором запуске падает.
 * Поэтому наличие колонки проверяется по схеме.
 */
const ADDED_COLUMNS: readonly { table: string; column: string; ddl: string }[] = [
  { table: 'profile', column: 'display_name', ddl: 'TEXT' },
  { table: 'profile', column: 'avatar', ddl: 'TEXT' },
];

export function migrate(): void {
  const db = getRawDb();
  db.executeSync('BEGIN');
  try {
    for (const statement of MIGRATIONS) {
      db.executeSync(statement);
    }

    for (const { table, column, ddl } of ADDED_COLUMNS) {
      const info = db.executeSync(`PRAGMA table_info(${table});`);
      const exists = (info.rows as { name: string }[]).some((row) => row.name === column);
      if (!exists) db.executeSync(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl};`);
    }

    db.executeSync('COMMIT');
  } catch (error) {
    db.executeSync('ROLLBACK');
    throw error;
  }
}

/** Только для дев-панели: снести всё и начать заново. */
export function resetDatabase(): void {
  const db = getRawDb();
  const tables = [
    'track_points',
    'explored_cells',
    'walk_sessions',
    'place_discoveries',
    'user_achievements',
    'xp_events',
    'outbox',
  ];
  db.executeSync('BEGIN');
  try {
    for (const table of tables) db.executeSync(`DELETE FROM ${table};`);
    db.executeSync(
      `UPDATE profile SET level = 1, xp = 0, streak_days = 0, best_streak = 0,
       last_active_date = NULL, origin_lat = NULL, origin_lng = NULL WHERE id = 1;`,
    );
    db.executeSync('COMMIT');
  } catch (error) {
    db.executeSync('ROLLBACK');
    throw error;
  }
}
