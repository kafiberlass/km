/**
 * Фабрика провайдера друзей.
 *
 * Вынесена из index.ts намеренно: хуки берут фабрику отсюда, а index
 * только собирает публичный интерфейс модуля. Если хуки тянуть из index,
 * а index — хуки, получается цикл импортов: Metro его разрешает, но
 * значения в момент загрузки могут оказаться неинициализированными.
 */

import type { LngLat } from '@/core/geo/mercator';

import { serverConfig } from './config';
import { MockFriendsProvider } from './mock';
import { createSupabaseProvider } from './supabase';
import type { FriendsProvider } from './types';

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
