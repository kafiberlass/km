/**
 * Фабрика провайдеров.
 *
 * transistor.ts намеренно не импортируется статически: пакета
 * react-native-background-geolocation в зависимостях НЕТ, он ставится
 * отдельно, когда до него дойдут руки (в debug-сборках бесплатен).
 * Статический импорт отсутствующего модуля уронил бы Metro на старте.
 */

import { ExpoLocationProvider } from './expoLocation';
import { MockTrackingProvider } from './mock';
import type { TrackingProvider } from './types';

export * from './types';
export { MockTrackingProvider, DEFAULT_MOCK_OPTIONS } from './mock';
export { ExpoLocationProvider, BACKGROUND_TASK } from './expoLocation';

export type ProviderId = TrackingProvider['id'];

/**
 * Порядок предпочтения:
 *  1. transistor — если пакет доступен (лучшее качество, бесплатен в debug);
 *  2. expo-location — рабочий бесплатный fallback;
 *  3. mock — только в дев-панели, явным выбором.
 */
export function createProvider(id: ProviderId): TrackingProvider {
  switch (id) {
    case 'mock':
      return new MockTrackingProvider();
    case 'transistor': {
      const provider = tryCreateTransistor();
      if (provider) return provider;
      console.warn(
        '[tracking] react-native-background-geolocation не установлен, откат на expo-location',
      );
      return new ExpoLocationProvider();
    }
    case 'expo-location':
    default:
      return new ExpoLocationProvider();
  }
}

export function isTransistorAvailable(): boolean {
  return tryResolveTransistor() != null;
}

/**
 * Проверяем не факт импорта, а наличие настоящего API.
 *
 * Когда пакет не установлен, metro.config.js подменяет его пустым модулем
 * (иначе сборка падает на статическом резолве). Пустышка импортируется
 * успешно, поэтому отличать её приходится по методам.
 */
function tryResolveTransistor(): unknown {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const raw = require('react-native-background-geolocation');
    const module = raw?.default ?? raw;
    return typeof module?.ready === 'function' ? module : null;
  } catch {
    return null;
  }
}

function tryCreateTransistor(): TrackingProvider | null {
  const module = tryResolveTransistor();
  if (!module) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { TransistorProvider } = require('./transistor') as {
      TransistorProvider: new () => TrackingProvider;
    };
    return new TransistorProvider();
  } catch (error) {
    console.warn('[tracking] не удалось поднять TransistorProvider', error);
    return null;
  }
}

let singleton: TrackingProvider | null = null;

export function getProvider(): TrackingProvider {
  if (!singleton) {
    singleton = createProvider(
      isTransistorAvailable() ? 'transistor' : 'expo-location',
    );
  }
  return singleton;
}

/** Переключение из дев-панели. Останавливает предыдущий провайдер. */
export async function switchProvider(id: ProviderId): Promise<TrackingProvider> {
  if (singleton) await singleton.stop().catch(() => undefined);
  singleton = createProvider(id);
  return singleton;
}
