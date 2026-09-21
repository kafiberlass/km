/**
 * Отправка своей недели друзьям.
 *
 * Одно число — сколько метров за семь дней. Маршруты на сервер
 * по-прежнему не уезжают: хранить чужой след перемещений — совсем другой
 * уровень ответственности, а для полоски «кто сколько прошёл» достаточно
 * итога.
 *
 * Отправляется редко: число меняется медленно, а сеть в кармане
 * не бесплатна. Раз в три часа и всякий раз после прогулки — этого
 * хватает, чтобы у друга оно не выглядело вчерашним.
 */

import { getValue, setValue } from '@/core/db/kv';
import type { LngLat } from '@/core/geo/mercator';

import { createFriendsProvider } from './provider';
// Само правило «пора или нет» живёт в publish.ts вместе с правилом для
// позиции: там чистый модуль без базы, и его видно тестами.
import { shouldPublishWeek } from './publish';

const KEY = 'week-published-at';

let inFlight = false;

export function publishWeekIfNeeded(
  origin: LngLat,
  meters: number,
  options: { force?: boolean } = {},
): void {
  if (inFlight) return;

  const lastAt = Number(getValue(KEY)) || null;
  if (!shouldPublishWeek(lastAt, Date.now(), options.force === true)) return;

  const provider = createFriendsProvider(origin);
  if (!provider.publishWeek) return;

  inFlight = true;
  void provider
    .publishWeek(meters)
    .then(() => {
      // Отметка — только после ответа сервера: иначе упавшая отправка
      // считалась бы удачной и следующая отложилась бы на три часа.
      setValue(KEY, String(Date.now()));
    })
    .catch((error: unknown) => {
      console.warn('[friends] неделя не отправлена', error);
    })
    .finally(() => {
      inFlight = false;
    });
}
