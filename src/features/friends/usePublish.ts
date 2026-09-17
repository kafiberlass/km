/**
 * Отправка своей позиции друзьям.
 *
 * Включается только во время прогулки. Это и про батарею, и про суть
 * приложения: друзья видят, что человек сейчас гуляет, а не круглосуточную
 * трансляцию его перемещений. Выключил трекинг — перестал делиться.
 */

import { useEffect, useRef } from 'react';

import type { LngLat } from '@/core/geo/mercator';

import { createFriendsProvider } from './index';
import { shouldPublish, type PublishState } from './publish';

export function usePublishPosition(
  origin: LngLat | null,
  point: LngLat | null,
  enabled: boolean,
): void {
  const last = useRef<PublishState | null>(null);

  useEffect(() => {
    if (!enabled) {
      // Следующий выход на прогулку начинается с чистого листа: иначе
      // первая точка новой прогулки может не уйти, решив, что «недавно уже».
      last.current = null;
      return;
    }
    if (!origin || !point) return;

    const now = Date.now();
    if (!shouldPublish(last.current, point, now)) return;

    const provider = createFriendsProvider(origin);
    if (!provider.publishPosition) return;

    last.current = { point, at: now };
    void provider.publishPosition(point).catch((error: unknown) => {
      console.warn('[friends] позиция не отправлена', error);
    });
  }, [enabled, origin?.lat, origin?.lng, point?.lat, point?.lng]);
}
