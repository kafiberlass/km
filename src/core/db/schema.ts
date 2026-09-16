/**
 * Схема локальной БД.
 *
 * Бэкенда в v1 нет, но поля `updatedAt` / `syncedAt` и таблица `outbox`
 * заведены сразу. Добавить синк потом = написать воркер, а не мигрировать
 * данные пользователей, у которых уже год истории.
 */

import { index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** Профиль в единственном экземпляре: id всегда 1. */
export const profile = sqliteTable('profile', {
  id: integer('id').primaryKey(),
  level: integer('level').notNull().default(1),
  xp: integer('xp').notNull().default(0),
  streakDays: integer('streak_days').notNull().default(0),
  bestStreak: integer('best_streak').notNull().default(0),
  lastActiveDate: text('last_active_date'),
  timeZone: text('time_zone').notNull().default('UTC'),
  /** Origin проектора для Skia — см. core/geo/mercator.ts. Задаётся первой точкой. */
  originLat: real('origin_lat'),
  originLng: real('origin_lng'),
  homeRegionId: text('home_region_id'),
  updatedAt: integer('updated_at').notNull().default(0),
  syncedAt: integer('synced_at'),
});

export const walkSessions = sqliteTable(
  'walk_sessions',
  {
    id: text('id').primaryKey(),
    startedAt: integer('started_at').notNull(),
    endedAt: integer('ended_at'),
    distanceM: real('distance_m').notNull().default(0),
    durationS: integer('duration_s').notNull().default(0),
    newCells: integer('new_cells').notNull().default(0),
    /** 'device' | 'mock' | 'import' — фейковые прогулки не должны попадать в статистику. */
    source: text('source').notNull().default('device'),
    isNight: integer('is_night', { mode: 'boolean' }).notNull().default(false),
    updatedAt: integer('updated_at').notNull().default(0),
    syncedAt: integer('synced_at'),
  },
  (t) => [index('idx_sessions_started').on(t.startedAt)],
);

export const trackPoints = sqliteTable(
  'track_points',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sessionId: text('session_id').notNull(),
    /** Индекс сегмента: разрывы трека не должны рисоваться прямой линией. */
    segment: integer('segment').notNull().default(0),
    lat: real('lat').notNull(),
    lng: real('lng').notNull(),
    accuracy: real('accuracy').notNull(),
    speed: real('speed'),
    heading: real('heading'),
    altitude: real('altitude'),
    recordedAt: integer('recorded_at').notNull(),
  },
  (t) => [index('idx_points_session').on(t.sessionId, t.segment, t.recordedAt)],
);

/**
 * Открытые ячейки. Самая горячая таблица: вставляется пачками,
 * читается по родителю при рендере вьюпорта.
 */
export const exploredCells = sqliteTable(
  'explored_cells',
  {
    h3: text('h3').primaryKey(),
    parent: text('parent').notNull(),
    firstSeenAt: integer('first_seen_at').notNull(),
    sessionId: text('session_id'),
    syncedAt: integer('synced_at'),
  },
  (t) => [index('idx_cells_parent').on(t.parent)],
);

export const places = sqliteTable(
  'places',
  {
    id: text('id').primaryKey(),
    lat: real('lat').notNull(),
    lng: real('lng').notNull(),
    /** cafe | park | viewpoint | ... — иконка на карте. */
    type: text('type').notNull(),
    title: text('title').notNull(),
    subtitle: text('subtitle'),
    /** Радиус, внутри которого место засчитывается найденным. */
    radiusM: real('radius_m').notNull().default(80),
    xpReward: integer('xp_reward').notNull().default(50),
  },
  (t) => [index('idx_places_bbox').on(t.lat, t.lng)],
);

export const placeDiscoveries = sqliteTable('place_discoveries', {
  placeId: text('place_id').primaryKey(),
  discoveredAt: integer('discovered_at').notNull(),
  sessionId: text('session_id'),
  syncedAt: integer('synced_at'),
});

export const userAchievements = sqliteTable('user_achievements', {
  code: text('code').primaryKey(),
  unlockedAt: integer('unlocked_at').notNull(),
  syncedAt: integer('synced_at'),
});

/** Append-only журнал начислений: аудит, backfill и будущая сверка с сервером. */
export const xpEvents = sqliteTable(
  'xp_events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    kind: text('kind').notNull(),
    amount: integer('amount').notNull(),
    ref: text('ref'),
    sessionId: text('session_id'),
    createdAt: integer('created_at').notNull(),
    syncedAt: integer('synced_at'),
  },
  (t) => [index('idx_xp_created').on(t.createdAt)],
);

/** Очередь на отправку. В v1 не читается — ждёт появления сервера. */
export const outbox = sqliteTable(
  'outbox',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    entity: text('entity').notNull(),
    entityId: text('entity_id').notNull(),
    op: text('op').notNull(),
    payload: text('payload').notNull(),
    createdAt: integer('created_at').notNull(),
    attempts: integer('attempts').notNull().default(0),
  },
  (t) => [index('idx_outbox_created').on(t.createdAt)],
);

/** Кэш знаменателя для «открыто N%»: считать polygonToCells на каждый рендер дорого. */
export const regions = sqliteTable(
  'regions',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    /** GeoJSON-полигон границ, [[lng, lat], ...]. */
    boundary: text('boundary').notNull(),
    totalCells: integer('total_cells').notNull(),
  },
);

export const regionCellIndex = sqliteTable(
  'region_cells',
  {
    regionId: text('region_id').notNull(),
    parent: text('parent').notNull(),
    cellCount: integer('cell_count').notNull(),
  },
  (t) => [primaryKey({ columns: [t.regionId, t.parent] })],
);
