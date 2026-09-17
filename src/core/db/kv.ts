/**
 * Маленькое хранилище «ключ — значение» в той же SQLite.
 *
 * Нужно для мелочей, которым не место в схеме: настройки-переключатели,
 * токен сессии Supabase. Заводить ради них таблицы с миграциями —
 * больше кода, чем пользы; тянуть AsyncStorage — лишний нативный пакет.
 */

import { getRawDb } from './client';

const TABLE = 'kv_store';

function ensureTable(): void {
  getRawDb().executeSync(
    `CREATE TABLE IF NOT EXISTS ${TABLE} (key TEXT PRIMARY KEY, value TEXT NOT NULL);`,
  );
}

export function getValue(key: string): string | null {
  ensureTable();
  const result = getRawDb().executeSync(`SELECT value FROM ${TABLE} WHERE key = ?;`, [key]);
  const row = (result.rows as unknown[])[0] as { value?: string } | undefined;
  return row?.value ?? null;
}

export function setValue(key: string, value: string): void {
  ensureTable();
  getRawDb().executeSync(
    `INSERT INTO ${TABLE} (key, value) VALUES (?, ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value;`,
    [key, value],
  );
}

export function removeValue(key: string): void {
  ensureTable();
  getRawDb().executeSync(`DELETE FROM ${TABLE} WHERE key = ?;`, [key]);
}

export function getFlag(key: string, fallback: boolean): boolean {
  const raw = getValue(key);
  if (raw == null) return fallback;
  return raw === '1';
}

export function setFlag(key: string, value: boolean): void {
  setValue(key, value ? '1' : '0');
}
