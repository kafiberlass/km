/**
 * Публичный интерфейс модуля друзей.
 *
 * Только реэкспорты: сам ничего не создаёт, поэтому его можно тянуть
 * откуда угодно, не рискуя циклом.
 */

export * from './types';
export { MockFriendsProvider } from './mock';
export { SupabaseFriendsProvider } from './supabase';
export { serverConfig } from './config';
export { createFriendsProvider, isServerConfigured } from './provider';
export { useFriends } from './useFriends';
export { usePublishPosition } from './usePublish';
export { shouldPublish, PUBLISH_MIN_DISTANCE_M, PUBLISH_MIN_INTERVAL_MS } from './publish';
