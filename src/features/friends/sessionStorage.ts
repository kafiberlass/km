/**
 * Хранилище сессии Supabase поверх уже открытой SQLite.
 *
 * Supabase просит async-хранилище для токенов. Штатный вариант —
 * AsyncStorage, но это ещё один нативный пакет и ещё одна пересборка
 * ради таблицы из двух колонок. База у приложения уже есть.
 */

import { getRawDb } from '@/core/db/client';

const TABLE = 'kv_store';

function ensureTable(): void {
  getRawDb().executeSync(
    `CREATE TABLE IF NOT EXISTS ${TABLE} (key TEXT PRIMARY KEY, value TEXT NOT NULL);`,
  );
}

export const sqliteSessionStorage = {
  getItem(key: string): Promise<string | null> {
    ensureTable();
    const result = getRawDb().executeSync(`SELECT value FROM ${TABLE} WHERE key = ?;`, [key]);
    const row = result.rows?.[0] as { value?: string } | undefined;
    return Promise.resolve(row?.value ?? null);
  },

  setItem(key: string, value: string): Promise<void> {
    ensureTable();
    getRawDb().executeSync(
      `INSERT INTO ${TABLE} (key, value) VALUES (?, ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value;`,
      [key, value],
    );
    return Promise.resolve();
  },

  removeItem(key: string): Promise<void> {
    ensureTable();
    getRawDb().executeSync(`DELETE FROM ${TABLE} WHERE key = ?;`, [key]);
    return Promise.resolve();
  },
};
