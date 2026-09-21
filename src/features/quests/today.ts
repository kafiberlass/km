/**
 * Квест сегодняшнего дня: сбор данных и учёт выполнения.
 *
 * Сам выбор квеста — чистая функция в quest.ts. Здесь всё, что требует
 * базы: чем человек располагает сегодня, сколько уже прошёл и получал ли
 * он уже награду. Разделение не ради красоты: правила выбора проверяются
 * тестами, а к базе в тестах не подключишься.
 */

import { getValue, setValue } from '@/core/db/kv';
import { allPlaces, listWalks } from '@/core/db/repo';
import { haversineMeters, type LngLat } from '@/core/geo/mercator';
import { localDateKey } from '@/core/rules/streak';
import { groupByDay } from '@/core/walk/history';

import { pickQuest, questProgress, type Quest, type QuestContext, type QuestProgress } from './quest';

/** Ключ награды: по одной в день, даже если приложение перезапускали. */
function rewardKey(dateKey: string): string {
  return `quest-rewarded-${dateKey}`;
}

export function isQuestRewarded(dateKey: string): boolean {
  return getValue(rewardKey(dateKey)) === '1';
}

export function markQuestRewarded(dateKey: string): void {
  setValue(rewardKey(dateKey), '1');
}

/**
 * Сколько человек обычно проходит за день.
 *
 * Медиана, а не среднее: один поход за город на двадцать километров
 * сдвинул бы среднее так, что обычные дни стали бы «невыполненными».
 * Считаем по ходовым дням — дни, когда человек не выходил вовсе,
 * в привычку не входят.
 */
export function typicalDailyM(timeZone: string, now: number): number {
  const days = groupByDay(listWalks(), timeZone)
    .filter((day) => day.dateKey !== localDateKey(now, timeZone))
    .slice(0, 14)
    .map((day) => day.totals.distanceM)
    .filter((meters) => meters > 200)
    .sort((a, b) => a - b);

  if (days.length === 0) return 0;
  return days[Math.floor(days.length / 2)]!;
}

export interface TodayInput {
  origin: LngLat | null;
  districts: ReadonlyMap<string, number>;
  /**
   * Сколько клеток нужно кварталу, чтобы считаться закрытым.
   *
   * Именно «закрытым по правилам игры», а не «пройденным целиком»:
   * квартал засчитывается с 80% покрытия, и квест обязан считать так же.
   * Иначе он остался бы невыполненным на карточке, где квартал уже
   * помечен закрытым.
   */
  cellsToClose: number;
  timeZone: string;
  now: number;
}

export function buildQuestContext(input: TodayInput): QuestContext {
  const origin = input.origin;

  const places = allPlaces()
    .filter((place) => place.discoveredAt == null)
    .map((place) => ({
      id: place.id,
      title: place.title,
      type: place.type,
      distanceM: origin
        ? haversineMeters(origin, { lat: place.lat, lng: place.lng })
        : Number.POSITIVE_INFINITY,
    }));

  const districts = [...input.districts.entries()].map(([id, cells]) => ({
    id,
    ratio: Math.min(1, cells / input.cellsToClose),
  }));

  return { places, districts, typicalM: typicalDailyM(input.timeZone, input.now) };
}

/** Сколько пройдено сегодня — по местным суткам, а не по последним 24 часам. */
export function walkedTodayM(timeZone: string, now: number): number {
  const today = localDateKey(now, timeZone);
  const day = groupByDay(listWalks(), timeZone).find((group) => group.dateKey === today);
  return day?.totals.distanceM ?? 0;
}

/** Места, открытые сегодня: ими закрываются квесты «дойти до места». */
export function placesOpenedTodayIds(timeZone: string, now: number): string[] {
  const today = localDateKey(now, timeZone);
  return allPlaces()
    .filter((place) => place.discoveredAt != null && localDateKey(place.discoveredAt, timeZone) === today)
    .map((place) => place.id);
}

export interface TodayQuest {
  dateKey: string;
  quest: Quest;
  progress: QuestProgress;
}

/** Квест дня вместе с тем, насколько он выполнен прямо сейчас. */
export function todayQuest(input: TodayInput, liveDistanceM = 0): TodayQuest {
  const dateKey = localDateKey(input.now, input.timeZone);
  const quest = pickQuest(dateKey, buildQuestContext(input));

  const districtRatio =
    quest.targetId != null
      ? Math.min(1, (input.districts.get(quest.targetId) ?? 0) / input.cellsToClose)
      : 0;

  const progress = questProgress(quest, {
    // Прогулка, которая идёт прямо сейчас, ещё не записана в историю:
    // без неё полоска стояла бы на месте до самого конца прогулки.
    todayM: walkedTodayM(input.timeZone, input.now) + liveDistanceM,
    openedPlaceIds: placesOpenedTodayIds(input.timeZone, input.now),
    districtRatio,
  });

  return { dateKey, quest, progress };
}
