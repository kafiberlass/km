/**
 * Фабрика провайдера друзей.
 *
 * Сейчас реализация одна — демо. Когда появится сервер, здесь встанет
 * выбор: настоящий провайдер, если есть сессия и сеть, демо — в дев-панели.
 */

import type { LngLat } from '@/core/geo/mercator';

import { MockFriendsProvider } from './mock';
import type { FriendsProvider } from './types';

export * from './types';
export { MockFriendsProvider } from './mock';
export { useFriends } from './useFriends';

export function createFriendsProvider(origin: LngLat): FriendsProvider {
  return new MockFriendsProvider(origin);
}
