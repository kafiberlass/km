/**
 * Кто рядом со мной прямо сейчас.
 *
 * На карте два человека в одном дворе — это две метки друг на друге,
 * которые приходится растаскивать. Но растащить — значит соврать: они
 * действительно в одном месте, и это отдельное событие, а не помеха
 * отрисовке. Поэтому такие метки не разводятся, а собираются в одну.
 *
 * Расстояние — по земле, в метрах, а не в пикселях: «мы вместе» не должно
 * зависеть от того, насколько человек приблизил карту.
 */

import { haversineMeters, type LngLat } from '@/core/geo/mercator';

/**
 * С какого расстояния считаем, что люди вместе.
 *
 * Шестьдесят метров — двор, кафе, вагон метро. Меньше — и метка будет
 * мигать от дрожания GPS, который в городе врёт на десятки метров.
 * Больше — и «вместе» окажутся люди на разных сторонах квартала.
 */
export const TOGETHER_RADIUS_M = 60;

export interface Nearby<T> {
  /** Те, кто рядом со мной. */
  together: T[];
  /** Все остальные — рисуются обычными метками. */
  apart: T[];
}

export function splitByDistance<T>(
  me: LngLat,
  people: readonly T[],
  at: (person: T) => LngLat | null | undefined,
  radiusM: number = TOGETHER_RADIUS_M,
): Nearby<T> {
  const together: T[] = [];
  const apart: T[] = [];

  for (const person of people) {
    const point = at(person);

    // Без позиции человек не «далеко» и не «рядом»: его просто не видно
    // на карте, и в группу он попасть не может.
    if (!point) continue;

    if (haversineMeters(me, point) <= radiusM) together.push(person);
    else apart.push(person);
  }

  return { together, apart };
}

/**
 * Подпись под группой: «ВМЕСТЕ: ЛЕНА».
 *
 * Имя стоит в той форме, в какой человек его записал, — и это не лень.
 * Правильное «вместе с Леной» требует творительного падежа, а склонять
 * имена нельзя: «Лена → Леной» угадывается, «Николай» и «Айгуль» уже
 * нет, а коверкать чужое имя хуже, чем обойтись двоеточием.
 */
export function togetherLabel(names: readonly string[]): string {
  if (names.length === 0) return '';
  if (names.length <= 2) return `ВМЕСТЕ: ${names.map((n) => n.toUpperCase()).join(', ')}`;
  return `ВМЕСТЕ · РЯДОМ ${names.length}`;
}
