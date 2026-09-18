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

import { clearActiveWalk, loadActiveWalk, saveActiveWalk } from '@/core/db/activeWalk';
import { drainInbox } from '@/core/db/inbox';
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
import { restoreWalk } from '@/core/walk/restore';
import { isWalkResumable } from '@/core/walk/session';
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
import {
  getProvider,
  type PermissionLevel,
  type TrackingProvider,
  type TrackingStatus,
} from '@/features/tracking';

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

  /** Что разрешил человек: от этого зависит, переживёт ли прогулка сворачивание. */
  permission: PermissionLevel | null;
  /** Идёт ли запись в фоне прямо сейчас. */
  background: boolean;

  start: (options?: { source?: string }) => Promise<void>;
  stop: () => Promise<void>;
  ingest: (point: GeoPoint) => void;
  dismissToast: () => void;
  hydrate: () => void;
  /** Подхватить прогулку, которая шла до выгрузки приложения. */
  resume: () => void;
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
  permission: null,
  background: false,

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

    get().resume();
  },

  start: async ({ source = 'device' } = {}) => {
    if (get().status === 'tracking') return;

    provider = getProvider();
    const permission = await provider.requestPermissions();
    if (permission.level === 'denied') {
      set({ status: 'error', permission: 'denied' });
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

    // Сессия создаётся ДО первой точки: фоновый провайдер начинает отдавать
    // накопленное сразу из start(), и писать их было бы некуда.
    // Ночная прогулка или нет — определится по первой точке.
    repo.createSession(sessionId, startedAt, source, false);

    // Запись переживает выгрузку приложения: iOS может убить процесс
    // и поднять его заново только ради пачки координат — без этой строки
    // проснувшееся приложение считает, что никто никуда не идёт.
    saveActiveWalk({ sessionId, startedAt, source });

    unsubscribe = provider.subscribe((point) => get().ingest(point));
    await provider.start();
    set({
      status: 'tracking',
      permission: permission.level,
      background: provider.isBackgroundActive?.() ?? false,
    });
  },

  stop: async () => {
    const { sessionId, startedAt, distanceM, newCells } = get();

    // Порядок важен: provider.stop() разбирает остаток фоновой очереди,
    // и отписаться раньше — значит выбросить последние метры прогулки.
    await provider?.stop().catch(() => undefined);
    unsubscribe?.();
    unsubscribe = null;
    clearActiveWalk();

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

    set({ status: 'idle', sessionId: null, liveSegment: [], background: false });
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

  resume: () => {
    // hydrate зовут и из дев-панели после сброса базы: повторное
    // восстановление подписалось бы вторым слушателем на те же точки.
    if (unsubscribe) return;

    const active = loadActiveWalk();

    if (!active) {
      // Очередь могла остаться от прошлой жизни приложения: точки без
      // прогулки некуда девать, а приписывать их следующей — врать.
      try {
        drainInbox();
      } catch (error) {
        console.warn('[walk] не удалось очистить очередь', error);
      }
      return;
    }

    const restored = restoreWalk(repo.sessionPoints(active.sessionId));

    // Фильтр продолжает с последней записанной точки: если пауза вышла
    // долгой, он сам порвёт трек — это его работа, а не наша.
    filterState = { last: restored.last };
    pendingPoints = [];

    set({
      status: 'tracking',
      sessionId: active.sessionId,
      startedAt: active.startedAt,
      distanceM: restored.distanceM,
      newCells: repo.countSessionCells(active.sessionId),
      acceptedPoints: restored.points,
      rejectedPoints: 0,
      liveSegment: restored.liveSegment,
      segmentIndex: restored.segmentIndex,
      geometryVersion: get().geometryVersion + 1,
    });

    const resumed = getProvider();
    provider = resumed;
    unsubscribe = resumed.subscribe((point) => get().ingest(point));

    // Точки, накопленные, пока приложения не было, прогоняются обычным
    // конвейером: фильтр, H3, XP — всё как при живой прогулке.
    try {
      for (const point of drainInbox()) get().ingest(point);
    } catch (error) {
      console.warn('[walk] не удалось разобрать очередь', error);
    }

    void (async () => {
      try {
        await resumed.start();
        set({ background: resumed.isBackgroundActive?.() ?? false });
      } catch (error) {
        console.warn('[walk] не удалось продолжить запись', error);
      }

      // Прогулку, забытую со вчера, не продолжаем, а доводим до конца
      // обычным путём — с начислением опыта за пройденное.
      if (!isWalkResumable(active)) await get().stop();
    })();
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
