/**
 * Автоматическое определение прогулки.
 *
 * Идея простая: держим «якорь» — точку, от которой считаем смещение.
 * Ушёл от неё достаточно далеко и достаточно быстро — значит, идёшь,
 * прогулка начинается сама. Перестал двигаться надолго — заканчивается.
 *
 * Почему именно смещение от якоря, а не скорость из GPS: скорость в
 * городе скачет от переотражений, и по ней прогулка «начинается» у окна
 * дома. Смещение на сотню метров подделать отражением нельзя.
 *
 * Функция чистая: всё состояние приходит и уходит параметром. Поэтому
 * правило проверяется тестами, а не двухчасовой прогулкой по району.
 */

import { haversineMeters, type LngLat } from '@/core/geo/mercator';

/** Насколько надо уйти от якоря, чтобы это считалось началом прогулки. */
export const AUTO_START_DISTANCE_M = 120;

/** За какое время. Дальше якорь переносится: медленное блуждание по дому
 *  за неделю тоже наберёт сто метров, но прогулкой не является. */
export const AUTO_START_WINDOW_MS = 3 * 60_000;

/** Сколько стоять на месте, чтобы прогулка закончилась сама. */
export const AUTO_STOP_IDLE_MS = 6 * 60_000;

/** Меньше этого — дрожание приёмника, а не шаг. */
export const AUTO_MOVE_STEP_M = 25;

export interface AutoWalkState {
  /** Точка, от которой считаем смещение. */
  anchor: LngLat;
  /** Когда якорь поставлен. */
  anchorAt: number;
  /** Последнее заметное движение — по нему считается простой. */
  lastMoveAt: number;
}

export type AutoWalkAction = 'start' | 'stop' | null;

export interface AutoWalkDecision {
  action: AutoWalkAction;
  state: AutoWalkState;
}

/**
 * @param previous состояние с прошлого замера, null — первый
 * @param point    текущая позиция
 * @param now      время замера
 * @param walking  идёт ли прогулка прямо сейчас
 */
export function decideAutoWalk(
  previous: AutoWalkState | null,
  point: LngLat,
  now: number,
  walking: boolean,
): AutoWalkDecision {
  if (!previous) {
    return { action: null, state: { anchor: point, anchorAt: now, lastMoveAt: now } };
  }

  const moved = haversineMeters(previous.anchor, point);

  if (walking) {
    // Во время прогулки якорь тянется за человеком, а нас интересует
    // только одно: давно ли он вообще двигался.
    if (moved >= AUTO_MOVE_STEP_M) {
      return {
        action: null,
        state: { anchor: point, anchorAt: now, lastMoveAt: now },
      };
    }
    if (now - previous.lastMoveAt >= AUTO_STOP_IDLE_MS) {
      return {
        action: 'stop',
        state: { anchor: point, anchorAt: now, lastMoveAt: now },
      };
    }
    return { action: null, state: previous };
  }

  if (moved >= AUTO_START_DISTANCE_M && now - previous.anchorAt <= AUTO_START_WINDOW_MS) {
    return { action: 'start', state: { anchor: point, anchorAt: now, lastMoveAt: now } };
  }

  // Окно истекло — переносим якорь сюда и считаем заново.
  if (now - previous.anchorAt > AUTO_START_WINDOW_MS) {
    return { action: null, state: { anchor: point, anchorAt: now, lastMoveAt: now } };
  }

  return { action: null, state: previous };
}

/**
 * Закончилась ли прогулка сама собой.
 *
 * Отдельно от decideAutoWalk, потому что проверять это приходится там,
 * где точек нет вовсе: человек сел в кафе, трекер замолчал вместе с ним,
 * и «шесть минут без движения» некому заметить изнутри потока точек.
 * Ноль означает «движения ещё не было» — прогулку только что открыли.
 */
export function isIdleTooLong(
  lastMoveAt: number,
  now: number,
  limitMs: number = AUTO_STOP_IDLE_MS,
): boolean {
  if (lastMoveAt <= 0) return false;
  return now - lastMoveAt >= limitMs;
}

/**
 * Точки, с которых начинается прогулка, объявленная задним числом.
 *
 * Прогулка становится очевидной, только когда человек уже ушёл от якоря
 * на сотню метров. Эти сто метров — тоже часть пути, и брать их надо
 * от якоря, а не от момента объявления.
 */
export function pointsSince<T extends { timestamp: number }>(
  buffer: readonly T[],
  since: number,
): T[] {
  return buffer.filter((point) => point.timestamp >= since);
}
