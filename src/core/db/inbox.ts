/**
 * Очередь сырых точек, пришедших в фоне.
 *
 * Зачем она нужна: iOS может выгрузить приложение и поднять его заново
 * ради одной пачки координат. В этот момент нет ни экрана, ни состояния
 * прогулки — обрабатывать точку через обычный конвейер некому и нечем.
 * Поэтому фоновый таск делает единственное, что осмысленно в такой момент:
 * кладёт сырые координаты в базу и умолкает.
 *
 * Разбирает очередь тот, кто жив: запущенная прогулка, если приложение
 * в памяти, или восстановление сессии при следующем открытии. Так путь
 * не теряется, а конвейер (фильтр -> H3 -> XP) остаётся один на всех.
 *
 * Своя таблица, а не track_points: там лежит уже проверенный путь,
 * и мешать с ним сырьё, которое ещё может отсеять фильтр, нельзя.
 */

import type { GeoPoint } from '@/core/geo/filter';

import { getRawDb } from './client';

const TABLE = 'geo_inbox';

/**
 * Таблица создаётся при каждом обращении.
 *
 * Фоновый таск запускается в свежем JS-контексте, где миграции из
 * app/_layout.tsx ещё не выполнялись: там нет ни одного отрисованного
 * экрана. Дешёвый CREATE IF NOT EXISTS надёжнее порядка инициализации.
 */
function ensureTable(): void {
  getRawDb().executeSync(
    `CREATE TABLE IF NOT EXISTS ${TABLE} (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       lat REAL NOT NULL,
       lng REAL NOT NULL,
       accuracy REAL NOT NULL,
       speed REAL,
       heading REAL,
       altitude REAL,
       recorded_at INTEGER NOT NULL,
       is_mock INTEGER NOT NULL DEFAULT 0
     );`,
  );
}

export function appendInboxPoints(points: readonly GeoPoint[]): void {
  if (points.length === 0) return;
  ensureTable();

  const db = getRawDb();
  db.executeSync('BEGIN');
  try {
    for (const p of points) {
      db.executeSync(
        `INSERT INTO ${TABLE}
           (lat, lng, accuracy, speed, heading, altitude, recorded_at, is_mock)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.lat,
          p.lng,
          p.accuracy,
          p.speed ?? null,
          p.heading ?? null,
          p.altitude ?? null,
          p.timestamp,
          p.isMock ? 1 : 0,
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
 * Забрать и удалить накопленное.
 *
 * Удаляем по границе id, а не `DELETE FROM`: пока идёт разбор, фоновый
 * таск может дописать новую пачку, и снести её вместе с прочитанным
 * значило бы потерять кусок пути.
 */
export function drainInbox(): GeoPoint[] {
  ensureTable();
  const db = getRawDb();

  const result = db.executeSync(
    `SELECT id, lat, lng, accuracy, speed, heading, altitude, recorded_at, is_mock
     FROM ${TABLE} ORDER BY recorded_at, id;`,
  );

  const rows = result.rows as {
    id: number;
    lat: number;
    lng: number;
    accuracy: number;
    speed: number | null;
    heading: number | null;
    altitude: number | null;
    recorded_at: number;
    is_mock: number;
  }[];

  if (rows.length === 0) return [];

  const lastId = rows.reduce((max, row) => (row.id > max ? row.id : max), 0);
  db.executeSync(`DELETE FROM ${TABLE} WHERE id <= ?;`, [lastId]);

  return rows.map((row) => ({
    lat: row.lat,
    lng: row.lng,
    accuracy: row.accuracy,
    speed: row.speed,
    heading: row.heading,
    altitude: row.altitude,
    timestamp: row.recorded_at,
    isMock: row.is_mock === 1,
  }));
}

export function countInbox(): number {
  ensureTable();
  const result = getRawDb().executeSync(`SELECT COUNT(*) AS n FROM ${TABLE};`);
  return ((result.rows as { n: number }[])[0]?.n ?? 0) as number;
}
