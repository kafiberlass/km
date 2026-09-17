/**
 * Отправка своей позиции друзьям.
 *
 * Включается только во время прогулки. Это и про батарею, и про суть
 * приложения: друзья видят, что человек сейчас гуляет, а не круглосуточную
 * трансляцию его перемещений. Выключил трекинг — перестал делиться.
 */

import { useEffect, useRef } from 'react';

import type { LngLat } from '@/core/geo/mercator';

import { createFriendsProvider } from './provider';
import { shouldPublish, type PublishState } from './publish';

/**
 * Пауза после сетевой ошибки.
 *
 * Без неё каждая новая точка трека била бы в упавшую сеть, а во время
 * проигрывания фикстуры точки идут по несколько раз в секунду.
 */
const RETRY_BACKOFF_MS = 10_000;

export function usePublishPosition(
  origin: LngLat | null,
  point: LngLat | null,
  enabled: boolean,
): void {
  const last = useRef<PublishState | null>(null);
  const failedAt = useRef(0);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!enabled) {
      // Следующий выход на прогулку начинается с чистого листа: иначе
      // первая точка новой прогулки может не уйти, решив, что «недавно уже».
      last.current = null;
      failedAt.current = 0;
      return;
    }
    if (!origin || !point) return;

    const now = Date.now();
    if (inFlight.current) return;
    if (now - failedAt.current < RETRY_BACKOFF_MS) return;
    if (!shouldPublish(last.current, point, now)) return;

    const provider = createFriendsProvider(origin);
    if (!provider.publishPosition) return;

    inFlight.current = true;
    void provider
      .publishPosition(point)
      .then(() => {
        // Отметку ставим только после ответа сервера. Иначе упавшая
        // отправка считалась бы удачной, и следующая попытка отложилась
        // бы на минуту — ровно тогда, когда связь как раз вернулась.
        last.current = { point, at: Date.now() };
        failedAt.current = 0;
      })
      .catch((error: unknown) => {
        failedAt.current = Date.now();
        console.warn('[friends] позиция не отправлена', error);
      })
      .finally(() => {
        inFlight.current = false;
      });
  }, [enabled, origin?.lat, origin?.lng, point?.lat, point?.lng]);
}
