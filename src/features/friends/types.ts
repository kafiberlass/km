/**
 * Друзья на карте.
 *
 * Интерфейс отделён от реализации намеренно: «где друг сейчас» — это по
 * определению обмен данными между устройствами, то есть сервер, которого
 * в проекте нет. Пока данные отдаёт демо-провайдер, экран же написан так,
 * как будто они настоящие. Появится бэкенд — меняется один файл.
 *
 * Тот же приём, что и в src/features/tracking: там за одним интерфейсом
 * живут GPX-плеер, expo-location и платная библиотека.
 */

import type { LngLat } from '@/core/geo/mercator';

/** Место, где друг был. Тип нужен, чтобы выбрать иконку. */
export interface FriendVisit extends LngLat {
  id: string;
  title: string;
  type: 'cafe' | 'park' | 'viewpoint';
  /** Unix-время визита, миллисекунды. */
  visitedAt: number;
}

export interface FriendPosition extends LngLat {
  /** Когда позиция обновлялась. По ней считается «свежесть» метки. */
  updatedAt: number;
}

export interface Friend {
  id: string;
  name: string;
  /** Две буквы в кружок метки. */
  initials: string;
  /** Цвет метки: у каждого друга свой, иначе на карте их не различить. */
  color: string;
  /** null — друг не делится позицией прямо сейчас. */
  position: FriendPosition | null;
  visits: FriendVisit[];
}

export interface FriendsProvider {
  readonly id: 'mock' | 'server';
  /**
   * Подписка на обновления. Возвращает функцию отписки.
   *
   * Именно подписка, а не запрос: позиции друзей меняются сами по себе,
   * и экран не должен знать, приходят они по вебсокету, пушем или
   * опросом раз в минуту.
   */
  subscribe(listener: (friends: Friend[]) => void): () => void;
}

/** Считается ли позиция актуальной. Старую метку показываем приглушённой. */
export const POSITION_FRESH_MS = 5 * 60 * 1000;

export function isFresh(position: FriendPosition, now: number = Date.now()): boolean {
  return now - position.updatedAt <= POSITION_FRESH_MS;
}
