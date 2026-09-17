/**
 * Фабрика провайдера друзей.
 *
 * Сейчас реализация одна — демо. Когда появится сервер, здесь встанет
 * выбор: настоящий провайдер, если есть сессия и сеть, демо — в дев-панели.
 */

import type { LngLat } from '@/core/geo/mercator';

import { serverConfig } from './config';
import { MockFriendsProvider } from './mock';
import { createSupabaseProvider } from './supabase';
import type { FriendsProvider } from './types';

export * from './types';
export { MockFriendsProvider } from './mock';
export { SupabaseFriendsProvider } from './supabase';
export { serverConfig } from './config';
export { useFriends } from './useFriends';
export { usePublishPosition } from './usePublish';
export { shouldPublish, PUBLISH_MIN_DISTANCE_M, PUBLISH_MIN_INTERVAL_MS } from './publish';

/** Настроен ли сервер. Экранам это нужно, чтобы не обещать лишнего. */
export function isServerConfigured(): boolean {
  return serverConfig() != null;
}

/**
 * Провайдер один на приложение: у серверного внутри сессия и realtime-канал,
 * а экранов, которым нужны друзья, уже два — карта и список.
 */
let singleton: FriendsProvider | null = null;
let singletonOrigin: string | null = null;

export function createFriendsProvider(origin: LngLat): FriendsProvider {
  const key = `${origin.lat.toFixed(5)},${origin.lng.toFixed(5)}`;

  // Демо-друзья ходят вокруг точки отсчёта, поэтому при её смене провайдер
  // пересоздаётся. Серверному она не нужна — он переживает смену молча.
  if (singleton && (singleton.id === 'server' || singletonOrigin === key)) {
    return singleton;
  }

  singleton = createSupabaseProvider() ?? new MockFriendsProvider(origin);
  singletonOrigin = key;
  return singleton;
}
