/**
 * Движок прогулки: единственное место, где сходятся трекинг, фильтр,
 * H3-учёт, база и правила игры.
 *
 * Поток данных на каждую точку:
 *   provider -> filterStep -> [БД: точка] -> cellsAlongSegment
 *            -> [БД: ячейки] -> XP -> ачивки -> UI
 *
 * Всё, что можно, вынесено в чистые функции core/*, здесь только склейка
 * и побочные эффекты.
 */

import { create } from 'zustand';

import { insertCells, insertPoints } from '@/core/db/repo';
import * as repo from '@/core/db/repo';
import { CELL_RES, REVEAL_RADIUS_M, cellsAlongSegment, cellsAround } from '@/core/geo/coverage';
import {
  completedCount,
  countByDistrict,
  districtOf,
  newlyCompleted,
} from '@/core/geo/districts';
import {
  DEFAULT_FILTER,
  filterStep,
  initialFilterState,
  type FilterState,
  type GeoPoint,
} from '@/core/geo/filter';
import { isAfterSunset } from '@/core/geo/sun';
import { evaluate, type AchievementDef } from '@/core/rules/achievements';
import { deviceTimeZone, localDateKey, registerActivity } from '@/core/rules/streak';
import {
  XP_RATES,
  applyXp,
  xpForDistance,
  xpForDistricts,
  xpForNewCells,
  type LevelState,
} from '@/core/rules/xp';
import { getProvider, type TrackingProvider, type TrackingStatus } from '@/features/tracking';

/** Точки копятся и пишутся пачками: транзакция на каждую точку убивает батарею. */
const FLUSH_EVERY_POINTS = 10;

export interface ToastPayload {
  kind: 'achievement' | 'level-up' | 'place';
  title: string;
  subtitle: string;
}

interface WalkState {
  status: TrackingStatus;
  sessionId: string | null;
  startedAt: number | null;

  distanceM: number;
  newCells: number;
  /** Сколько учётных ячеек открыто в каждом квартале. */
  districts: ReadonlyMap<string, number>;
  /** Кварталов закрыто целиком. */
  districtsDone: number;
  acceptedPoints: number;
  rejectedPoints: number;

  /** Точки текущей прогулки — для инкрементальной дорисовки тумана. */
  liveSegment: { lat: number; lng: number }[];
  /** Растёт при каждом новом сегменте: слой тумана по нему понимает, что делать. */
  segmentIndex: number;
  /** Инкремент — сигнал слою тумана перестроить геометрию. */
  geometryVersion: number;

  level: number;
  xp: number;
  streakDays: number;
  exploredCells: number;

  toast: ToastPayload | null;

  start: (options?: { source?: string }) => Promise<void>;
  stop: () => Promise<void>;
  ingest: (point: GeoPoint) => void;
  dismissToast: () => void;
  hydrate: () => void;
}

let filterState: FilterState = initialFilterState;
let pendingPoints: GeoPoint[] = [];
let unsubscribe: (() => void) | null = null;
let provider: TrackingProvider | null = null;
let origin: { lat: number; lng: number } | null = null;

export const useWalkStore = create<WalkState>((set, get) => ({
  status: 'idle',
  sessionId: null,
  startedAt: null,
  distanceM: 0,
  newCells: 0,
  districts: new Map<string, number>(),
  districtsDone: 0,
  acceptedPoints: 0,
  rejectedPoints: 0,
  liveSegment: [],
  segmentIndex: 0,
  geometryVersion: 0,
  level: 1,
  xp: 0,
  streakDays: 0,
  exploredCells: 0,
  toast: null,

  hydrate: () => {
    const profile = repo.getProfile();
    origin =
      profile.originLat != null && profile.originLng != null
        ? { lat: profile.originLat, lng: profile.originLng }
        : null;

    // Прогресс кварталов собирается из всей истории один раз при старте,
    // дальше поддерживается добавлением новых ячеек.
    const districts = countByDistrict(repo.allCells());

    set({
      level: profile.level,
      xp: profile.xp,
      streakDays: profile.streakDays,
      exploredCells: repo.countCells(),
      districts,
      districtsDone: completedCount(districts),
    });
  },

  start: async ({ source = 'device' } = {}) => {
    if (get().status === 'tracking') return;

    provider = getProvider();
    const permission = await provider.requestPermissions();
    if (permission.level === 'denied') {
      set({ status: 'error' });
      return;
    }

    const sessionId = `w-${Date.now().toString(36)}`;
    const startedAt = Date.now();

    filterState = initialFilterState;
    pendingPoints = [];

    set({
      status: 'starting',
      sessionId,
      startedAt,
      distanceM: 0,
      newCells: 0,
      acceptedPoints: 0,
      rejectedPoints: 0,
      liveSegment: [],
      segmentIndex: 0,
    });

    unsubscribe = provider.subscribe((point) => get().ingest(point));
    await provider.start();
    set({ status: 'tracking' });

    // Сессия создаётся сразу, ночная она или нет — определится по первой точке.
    repo.createSession(sessionId, startedAt, source, false);
  },

  stop: async () => {
    const { sessionId, startedAt, distanceM, newCells } = get();

    unsubscribe?.();
    unsubscribe = null;
    await provider?.stop().catch(() => undefined);

    if (sessionId) {
      flushPending(sessionId, get().segmentIndex);

      const endedAt = Date.now();
      repo.finishSession(sessionId, {
        endedAt,
        distanceM,
        durationS: startedAt ? Math.round((endedAt - startedAt) / 1000) : 0,
        newCells,
      });

      awardSessionXp(sessionId, distanceM, newCells, set, get);
    }

    set({ status: 'idle', sessionId: null, liveSegment: [] });
  },

  ingest: (point) => {
    const { sessionId } = get();
    if (!sessionId) return;

    const result = filterStep(filterState, point, DEFAULT_FILTER);
    const previous = filterState.last;
    filterState = result.state;

    if (result.verdict.kind === 'rejected') {
      set((s) => ({ rejectedPoints: s.rejectedPoints + 1 }));
      return;
    }

    // Origin фиксируется первой валидной точкой в жизни пользователя
    // и больше не меняется — вся геометрия тумана к нему привязана.
    if (!origin) {
      origin = repo.ensureOrigin(point);
      markNightSession(sessionId, point);
    }

    pendingPoints.push(point);

    const cells =
      result.verdict.kind === 'accepted' && previous
        ? cellsAlongSegment(previous, point, REVEAL_RADIUS_M, CELL_RES)
        : cellsAround(point, REVEAL_RADIUS_M, CELL_RES);

    const addedCells = insertCells(cells, sessionId, point.timestamp);
    const added = addedCells.length;

    // Квартал засчитывается один раз — в момент перехода через порог,
    // поэтому сравниваем состояние до и после, а не спрашиваем «закрыт ли».
    const before = get().districts;
    const after = new Map(before);
    for (const cell of addedCells) {
      const district = districtOf(cell);
      after.set(district, (after.get(district) ?? 0) + 1);
    }
    const closed = newlyCompleted(before, after);

    set((s) => ({
      acceptedPoints: s.acceptedPoints + 1,
      distanceM:
        result.verdict.kind === 'accepted' ? s.distanceM + result.verdict.distanceM : s.distanceM,
      newCells: s.newCells + added,
      exploredCells: s.exploredCells + added,
      districts: after,
      districtsDone: s.districtsDone + closed.length,
      segmentIndex:
        result.verdict.kind === 'segment-start' && s.acceptedPoints > 0
          ? s.segmentIndex + 1
          : s.segmentIndex,
      liveSegment:
        result.verdict.kind === 'segment-start'
          ? [{ lat: point.lat, lng: point.lng }]
          : [...s.liveSegment, { lat: point.lat, lng: point.lng }],
      geometryVersion: s.geometryVersion + 1,
    }));

    if (closed.length > 0) awardDistricts(closed.length, sessionId, set, get);

    if (pendingPoints.length >= FLUSH_EVERY_POINTS) {
      flushPending(sessionId, get().segmentIndex);
    }
  },

  dismissToast: () => set({ toast: null }),
}));

function flushPending(sessionId: string, segment: number): void {
  if (pendingPoints.length === 0) return;
  const batch = pendingPoints;
  pendingPoints = [];
  try {
    insertPoints(sessionId, segment, batch);
  } catch (error) {
    console.warn('[walk] не удалось записать точки', error);
    // Возвращаем в очередь: терять пройденный путь нельзя.
    pendingPoints = batch.concat(pendingPoints);
  }
}

function markNightSession(sessionId: string, point: GeoPoint): void {
  if (!isAfterSunset(point.timestamp, point.lat, point.lng)) return;
  repo.markSessionNight(sessionId);
}

/**
 * Начисление по итогам прогулки.
 *
 * Считается один раз в конце, а не по ходу: так журнал xp_events остаётся
 * читаемым, а пользователь видит один понятный итог вместо капающих цифр.
 */
function awardSessionXp(
  sessionId: string,
  distanceM: number,
  newCells: number,
  set: (partial: Partial<WalkState>) => void,
  get: () => WalkState,
): void {
  const profile = repo.getProfile();
  const timeZone = profile.timeZone === 'UTC' ? deviceTimeZone() : profile.timeZone;
  const today = localDateKey(Date.now(), timeZone);

  const streak = registerActivity(
    {
      streakDays: profile.streakDays,
      lastActiveDate: profile.lastActiveDate,
      bestStreak: profile.bestStreak,
    },
    today,
  );

  let total = xpForDistance(distanceM) + xpForNewCells(newCells);
  repo.appendXpEvent('distance', xpForDistance(distanceM), null, sessionId);
  repo.appendXpEvent('new-cells', xpForNewCells(newCells), null, sessionId);

  if (streak.change === 'started' || streak.change === 'continued') {
    total += XP_RATES.firstWalkOfDay;
    repo.appendXpEvent('first-walk-of-day', XP_RATES.firstWalkOfDay, null, sessionId);
  }

  // Ачивки считаются ПОСЛЕ обновления стрика: streak-7 должна сработать
  // в тот же вечер, когда седьмой день закрылся.
  repo.updateProfile({
    streakDays: streak.state.streakDays,
    bestStreak: streak.state.bestStreak,
    lastActiveDate: streak.state.lastActiveDate,
    timeZone,
  });

  const snapshot = repo.buildSnapshot(repo.countCells() || 1);
  const unlockedCodes = repo.unlockedAchievements();
  const { newlyUnlocked, xpAwarded } = evaluate(snapshot, unlockedCodes);

  for (const achievement of newlyUnlocked) {
    repo.unlockAchievement(achievement.code, Date.now());
    repo.appendXpEvent('achievement', achievement.xpReward, achievement.code, sessionId);
  }
  total += xpAwarded;

  const next = applyXp({ level: profile.level, xp: profile.xp } satisfies LevelState, total);
  repo.updateProfile({ level: next.level, xp: next.xp });

  set({
    level: next.level,
    xp: next.xp,
    streakDays: streak.state.streakDays,
    toast: buildToast(newlyUnlocked, next.levelUps) ?? get().toast,
  });
}

/**
 * Награда за закрытый квартал.
 *
 * Начисляется сразу, а не в конце прогулки: человек только что дошёл
 * последнюю улицу, и подтверждение должно прийти в этот момент, иначе
 * связи между действием и наградой не возникает.
 */
function awardDistricts(
  count: number,
  sessionId: string | null,
  set: (partial: Partial<WalkState>) => void,
  get: () => WalkState,
): void {
  const amount = xpForDistricts(count);
  repo.appendXpEvent('district-completed', amount, null, sessionId);

  const profile = repo.getProfile();
  const next = applyXp({ level: profile.level, xp: profile.xp } satisfies LevelState, amount);
  repo.updateProfile({ level: next.level, xp: next.xp });

  set({
    level: next.level,
    xp: next.xp,
    toast: {
      kind: 'level-up',
      title: count === 1 ? 'Квартал закрыт!' : `Закрыто кварталов: ${count}`,
      subtitle: `+${amount} XP · всего ${get().districtsDone}`,
    },
  });
}

function buildToast(unlocked: AchievementDef[], levelUps: number): ToastPayload | null {
  const first = unlocked[0];
  if (first) {
    return {
      kind: 'achievement',
      title: `Новая ачивка: ${first.title}`,
      subtitle: `${first.description} · +${first.xpReward} XP`,
    };
  }
  if (levelUps > 0) {
    return { kind: 'level-up', title: 'Новый уровень!', subtitle: 'Карта открывается дальше' };
  }
  return null;
}
