/**
 * Отправка своей позиции друзьям — без React.
 *
 * Раньше это был хук на экране карты, и метка друга ехала, только пока
 * приложение открыто: свернул — и брат видит тебя там, где ты была
 * в момент последнего открытия. Теперь отправка живёт в конвейере точек,
 * а он работает и в фоне, когда iOS будит приложение ради новых координат.
 *
 * Состояние модульное, потому что отправитель один на приложение:
 * два независимых счётчика «когда отправляли в прошлый раз» означали бы
 * двойной трафик и гонку за одну и ту же строку на сервере.
 */

import type { LngLat } from '@/core/geo/mercator';

import { createFriendsProvider } from './provider';
import { shouldPublish, type PublishState } from './publish';

/**
 * Пауза после сетевой ошибки. Без неё каждая следующая точка трека
 * била бы в упавшую сеть — а в фоне точки приходят пачками.
 */
const RETRY_BACKOFF_MS = 10_000;

let last: PublishState | null = null;
let failedAt = 0;
let inFlight = false;

/**
 * Следующая прогулка начинается с чистого листа: иначе первая точка
 * может не уйти, решив, что «недавно уже отправляли».
 */
export function resetPublisher(): void {
  last = null;
  failedAt = 0;
}

export function publishIfNeeded(origin: LngLat, point: LngLat, now: number = Date.now()): void {
  if (inFlight) return;
  if (now - failedAt < RETRY_BACKOFF_MS) return;
  if (!shouldPublish(last, point, now)) return;

  const provider = createFriendsProvider(origin);
  if (!provider.publishPosition) return;

  inFlight = true;
  void provider
    .publishPosition(point)
    .then(() => {
      // Отметку ставим только после ответа сервера. Иначе упавшая отправка
      // считалась бы удачной, и следующая попытка отложилась бы на минуту —
      // ровно тогда, когда связь как раз вернулась.
      last = { point, at: Date.now() };
      failedAt = 0;
    })
    .catch((error: unknown) => {
      failedAt = Date.now();
      console.warn('[friends] позиция не отправлена', error);
    })
    .finally(() => {
      inFlight = false;
    });
}
