/**
 * Хранилище сессии Supabase поверх уже открытой SQLite.
 *
 * Supabase просит async-хранилище для токенов. Штатный вариант —
 * AsyncStorage, но это ещё один нативный пакет и ещё одна пересборка
 * ради таблицы из двух колонок. База у приложения уже есть.
 */

import { getValue, removeValue, setValue } from '@/core/db/kv';

export const sqliteSessionStorage = {
  getItem(key: string): Promise<string | null> {
    return Promise.resolve(getValue(key));
  },

  setItem(key: string, value: string): Promise<void> {
    setValue(key, value);
    return Promise.resolve();
  },

  removeItem(key: string): Promise<void> {
    removeValue(key);
    return Promise.resolve();
  },
};
