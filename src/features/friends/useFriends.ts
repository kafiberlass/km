/**
 * Подписка на друзей.
 *
 * Провайдер пересоздаётся при смене точки отсчёта, а не на каждый рендер:
 * демо-друзья ходят вокруг неё, и пересоздание сбросило бы их движение.
 */

import { useEffect, useMemo, useState } from 'react';

import type { LngLat } from '@/core/geo/mercator';

import { createFriendsProvider } from './provider';
import type { Friend } from './types';

export function useFriends(origin: LngLat | null, enabled = true): Friend[] {
  const [friends, setFriends] = useState<Friend[]>([]);

  const provider = useMemo(
    () => (origin ? createFriendsProvider(origin) : null),
    [origin?.lat, origin?.lng],
  );

  useEffect(() => {
    if (!provider || !enabled) {
      setFriends([]);
      return;
    }
    return provider.subscribe(setFriends);
  }, [provider, enabled]);

  return friends;
}
