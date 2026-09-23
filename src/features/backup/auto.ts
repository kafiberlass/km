/**
 * Автоматическая копия на сервере.
 *
 * Запускается в конце прогулки — в тот момент, когда появилось что терять.
 * Ничего не ждёт и ничем не мешает: не получилось отправить (метро,
 * самолёт, сервер прилёг) — следующая прогулка попробует снова.
 *
 * Выключается переключателем на экране копии. Включено по умолчанию,
 * и это осознанно: человек, который не знает про резервные копии,
 * нуждается в них больше всех. Взамен экран прямо говорит, что история
 * уезжает с телефона.
 */

import { useSyncExternalStore } from 'react';

import { collectBackup } from '@/core/db/backup';
import { getFlag, getValue, setFlag, setValue } from '@/core/db/kv';
import { countSessions } from '@/core/db/repo';
import { createFlagStore } from '@/core/settings/flagStore';
import { createFriendsProvider, isServerConfigured } from '@/features/friends';

import { shouldAutoBackup } from './schedule';

const ENABLED_KEY = 'auto-backup';
const LAST_AT_KEY = 'auto-backup-at';
const LAST_WALKS_KEY = 'auto-backup-walks';

export const autoBackupSetting = createFlagStore(
  () => getFlag(ENABLED_KEY, true),
  (value) => setFlag(ENABLED_KEY, value),
);

export function useAutoBackup(): boolean {
  return useSyncExternalStore(
    autoBackupSetting.subscribe,
    autoBackupSetting.get,
    autoBackupSetting.get,
  );
}

function readNumber(key: string): number | null {
  const raw = getValue(key);
  if (raw == null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** Когда уехала последняя автоматическая копия. Для экрана. */
export function lastAutoBackupAt(): number | null {
  return readNumber(LAST_AT_KEY);
}

/**
 * Отправить копию, если пора.
 *
 * Вызывается из конвейера прогулки, поэтому ничего не возвращает и не
 * бросает: копия — дело десятое по сравнению с записью самой прогулки.
 */
export function autoBackup(now: number = Date.now()): void {
  let due = false;

  try {
    due = shouldAutoBackup({
      enabled: autoBackupSetting.get(),
      serverReady: isServerConfigured(),
      lastAt: readNumber(LAST_AT_KEY),
      lastWalks: readNumber(LAST_WALKS_KEY),
      walks: countSessions(),
      now,
    });
  } catch (error) {
    console.warn('[backup] не удалось понять, пора ли копию', error);
    return;
  }

  if (!due) return;

  void (async () => {
    try {
      const provider = createFriendsProvider({ lat: 0, lng: 0 });
      if (!provider.uploadBackup) return;

      // Собираем здесь, а не выше: сборка читает всю базу, и делать это
      // ради проверки «пора или нет» было бы расточительно.
      const data = collectBackup();
      await provider.uploadBackup(JSON.stringify(data));

      // Отметку ставим только после успеха: оборвавшаяся отправка не должна
      // считаться копией и отодвигать следующую попытку на полсуток.
      setValue(LAST_AT_KEY, String(now));
      setValue(LAST_WALKS_KEY, String(data.sessions.length));
    } catch (error) {
      console.warn('[backup] автоматическая копия не уехала', error);
    }
  })();
}
