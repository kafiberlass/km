/**
 * Круглосуточная трансляция позиции.
 *
 * По умолчанию ВЫКЛЮЧЕНА, и это не осторожность ради осторожности:
 * «делюсь, пока гуляю» и «делюсь всегда» — разные обещания, и второе
 * человек должен дать сам, а не обнаружить его включённым.
 *
 * Включённая трансляция отправляет позицию с тем же ограничением, что
 * и на прогулке: не чаще раза в минуту и ста метров. Стоишь на месте —
 * не уходит ничего, потому что и точек в это время не приходит.
 */

import { useSyncExternalStore } from 'react';

import { getFlag, setFlag } from '@/core/db/kv';
import { createFlagStore } from '@/core/settings/flagStore';

const KEY = 'share-always';

export const sharingSetting = createFlagStore(
  () => getFlag(KEY, false),
  (value) => setFlag(KEY, value),
);

export function useAlwaysSharing(): boolean {
  return useSyncExternalStore(sharingSetting.subscribe, sharingSetting.get, sharingSetting.get);
}
