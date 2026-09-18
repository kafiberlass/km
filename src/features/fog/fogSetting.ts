/**
 * Туман можно выключить — это дев-инструмент, а не игровая настройка.
 *
 * Под туманом не видно ни карты, ни того, правильно ли легла тропа.
 * Переключатель живёт в дев-панели, а действует на обоих экранах с картой.
 */

import { useSyncExternalStore } from 'react';

import { getFlag, setFlag } from '@/core/db/kv';
import { createFlagStore } from '@/core/settings/flagStore';

const KEY = 'fog-enabled';

export const fogSetting = createFlagStore(
  () => getFlag(KEY, true),
  (value) => setFlag(KEY, value),
);

export function useFogEnabled(): boolean {
  return useSyncExternalStore(fogSetting.subscribe, fogSetting.get, fogSetting.get);
}
