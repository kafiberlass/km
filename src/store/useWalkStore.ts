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
import { publishIfNeeded, resetPublisher } from '@/features/friends/publisher';
import { sharingSetting } from '@/features/friends/sharingSetting';
import {
  decideAutoWalk,
  isIdleTooLong,
  pointsSince,
  type AutoWalkState,
} from '@/features/tracking/autoWalk';
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
  IDLE_TRACKING_OPTIONS,
  WALK_TRACKING_OPTIONS,
  getProvider,
  type PermissionLevel,
  type TrackingProvider,
  type TrackingStatus,
} from '@/features/tracking';

/** Точки копятся и пишутся пачками: транзакция на каждую точку убивает батарею. */
const FLUSH_EVERY_POINTS = 10;

/**
 * Как часто проверять, не закончилась ли прогулка.
 *
 * Точки приходят только при движении: человек сел в кафе — и трекер
 * замолкает вместе с ним. Поэтому «шесть минут без движения» некому
 * заметить изнутри потока точек, нужен отдельный тик. В фоне таймеры
 * не идут, и там это же условие проверяется на следующей пришедшей точке.
 */
const IDLE_CHECK_MS = 60_000;

/**
 * Сколько последних дежурных точек помнить.
 *
 * Прогулка объявляется задним числом — когда человек уже ушёл от якоря
 * на сотню метров. Эти первые сто метров тоже часть пути, и без буфера
 * они бы просто не попали на карту.
 */
const RECENT_LIMIT = 40;

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

  /** Имя и аватар — их показывают сразу три экрана, поэтому живут здесь. */
  displayName: string | null;
  avatar: string | null;

  toast: ToastPayload | null;

  /** Что разрешил человек: от этого зависит, переживёт ли прогулка сворачивание. */
  permission: PermissionLevel | null;
  /** Идёт ли запись в фоне прямо сейчас. */
  background: boolean;

  start: (options?: { source?: string }) => Promise<void>;
  stop: () => Promise<void>;
  ingest: (point: GeoPoint) => void;
  /** Слушать геолокацию всё время: прогулку приложение объявляет само. */
  watch: () => void;
  /** Любая точка от трекера — и дежурная, и прогулочная. */
  observe: (point: GeoPoint) => void;
  /** Не пора ли закрыть прогулку: человек мог просто остановиться. */
  checkIdle: () => void;
  dismissToast: () => void;
  /** Сохранить имя и аватар: и в базу, и во все экраны разом. */
  saveIdentity: (name: string | null, avatar: string | null) => void;
  hydrate: () => void;
  /** Подхватить прогулку, которая шла до выгрузки приложения. */
  resume: () => void;
}

let filterState: FilterState = initialFilterState;
let pendingPoints: GeoPoint[] = [];
let unsubscribe: (() => void) | null = null;
let provider: TrackingProvider | null = null;
let origin: { lat: number; lng: number } | null = null;
let autoState: AutoWalkState | null = null;
let recent: GeoPoint[] = [];
let idleTimer: ReturnType<typeof setInterval> | null = null;
/** Время последней принятой точки: по нему определяется простой. */
let lastAcceptedAt = 0;
/** Признак «уже закрываем»: flush внутри stop может привести сюда повторно. */
let stopping = false;
/** Чем открыта текущая сессия: у фикстуры из дев-панели свой источник точек. */
let sessionSource = 'device';

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
  displayName: null,
  avatar: null,
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
      displayName: profile.displayName,
      avatar: profile.avatar,
      exploredCells: repo.countCells(),
      districts,
      districtsDone: completedCount(districts),
    });

    catchUpAchievements(set, get);

    get().resume();
    get().watch();
  },

  start: async ({ source = 'device' } = {}) => {
    if (get().sessionId) return;

    provider = getProvider();
    const permission = await provider.requestPermissions();
    if (permission.level === 'denied') {
      set({ status: 'error', permission: 'denied' });
      return;
    }
    set({ permission: permission.level });

    openWalk(source, Date.now(), set);
  },

  stop: async () => {
    const sessionId = get().sessionId;
    if (!sessionId || stopping) return;

    // Разбор очереди ниже может снова привести сюда: среди последних точек
    // окажется пауза длиннее шести минут, и observe решит закрыть прогулку
    // второй раз. Второе закрытие начислило бы опыт ещё раз.
    stopping = true;

    // Последние метры прогулки могли прийти секунду назад и ещё лежать
    // в фоновой очереди. Разбираем их, пока сессия открыта.
    provider?.flush?.();

    const { startedAt, distanceM, newCells, segmentIndex } = get();

    // Признак прогулки снимаем сразу, до записи в базу: точки, которые
    // придут за это время, не должны попасть в уже закрытую сессию.
    set({ status: 'idle', sessionId: null, liveSegment: [], background: false });

    flushPending(sessionId, segmentIndex);

    const endedAt = Date.now();
    repo.finishSession(sessionId, {
      endedAt,
      distanceM,
      durationS: startedAt ? Math.round((endedAt - startedAt) / 1000) : 0,
      newCells,
    });

    awardSessionXp(sessionId, distanceM, newCells, set, get);

    clearActiveWalk();
    resetPublisher();
    sessionSource = 'device';
    lastAcceptedAt = 0;
    // Детектор начинает с чистого листа: якорь от прошлой прогулки
    // объявил бы следующую прямо на пороге дома.
    autoState = null;
    recent = [];

    // Не выключаем геолокацию, а возвращаем дежурную передачу: следующую
    // прогулку приложение должно заметить само.
    void provider
      ?.start(IDLE_TRACKING_OPTIONS)
      .catch((error: unknown) => console.warn('[walk] дежурный режим не включился', error));

    stopping = false;
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

    // По этой отметке определяется простой — и в таймере, и на следующей
    // точке, если приложение в это время спало.
    lastAcceptedAt = point.timestamp;

    // Отправка живёт здесь, а не в хуке на экране: конвейер работает
    // и в фоне, поэтому метка едет за человеком с закрытым приложением.
    if (origin) publishIfNeeded(origin, point);

    if (pendingPoints.length >= FLUSH_EVERY_POINTS) {
      flushPending(sessionId, get().segmentIndex);
    }
  },

  watch: () => {
    // Слушаем геолокацию всё время, пока живёт приложение: кнопки
    // «начать прогулку» больше нет, и заметить её начало больше некому.
    if (unsubscribe) return;

    const tracker = getProvider();
    provider = tracker;
    unsubscribe = tracker.subscribe((point) => get().observe(point));

    if (!idleTimer) idleTimer = setInterval(() => get().checkIdle(), IDLE_CHECK_MS);

    void (async () => {
      const permission = await tracker.requestPermissions();
      set({ permission: permission.level });
      if (permission.level === 'denied') return;

      try {
        await tracker.start(get().sessionId ? WALK_TRACKING_OPTIONS : IDLE_TRACKING_OPTIONS);
        set({ background: tracker.isBackgroundActive?.() ?? false });
      } catch (error) {
        console.warn('[walk] не удалось включить слежение', error);
      }
    })();
  },

  observe: (point) => {
    const now = point.timestamp;

    // Во время проигрывания фикстуры настоящая геолокация молчит: иначе
    // в нарисованную прогулку попадёт точка из окна, где стоит телефон.
    if (sessionSource === 'mock' && get().sessionId) return;

    if (get().sessionId) {
      // Простой обнаруживается на следующей точке: пока человек сидит,
      // трекер молчит вместе с ним, и таймер в фоне тоже не идёт.
      if (isIdleTooLong(lastAcceptedAt, now)) {
        void get().stop();
        autoState = { anchor: point, anchorAt: now, lastMoveAt: now };
        recent = [point];
        return;
      }

      get().ingest(point);

      const decision = decideAutoWalk(autoState, point, now, true);
      autoState = decision.state;
      if (decision.action === 'stop') void get().stop();
      return;
    }

    // Круглосуточная трансляция: вне прогулки позиция уходит только если
    // человек включил это сам. Частота та же, что и на прогулке, —
    // ограничение живёт внутри publishIfNeeded.
    if (origin && sharingSetting.get()) publishIfNeeded(origin, point);

    recent.push(point);
    if (recent.length > RECENT_LIMIT) recent.shift();

    // Якорь ДО решения: именно от него человек ушёл, и именно оттуда
    // начинается прогулка, которую мы объявляем задним числом.
    const anchorAt = autoState?.anchorAt ?? now;

    const decision = decideAutoWalk(autoState, point, now, false);
    autoState = decision.state;
    if (decision.action !== 'start') return;

    const buffered = pointsSince(recent, anchorAt);
    openWalk('auto', buffered[0]?.timestamp ?? now, set);
    for (const earlier of buffered) get().ingest(earlier);
    recent = [];
  },

  checkIdle: () => {
    if (!get().sessionId) return;
    if (isIdleTooLong(lastAcceptedAt, Date.now())) void get().stop();
  },

  resume: () => {
    const active = loadActiveWalk();

    if (!active) {
      // Очереди без прогулки тоже есть что рассказать: пока приложения
      // не было, дежурные точки копились, и по ним видно, что человек
      // ушёл из дома. Прогулка объявится задним числом.
      try {
        for (const point of drainInbox()) get().observe(point);
      } catch (error) {
        console.warn('[walk] не удалось разобрать очередь', error);
      }
      return;
    }

    sessionSource = active.source;
    const restored = restoreWalk(repo.sessionPoints(active.sessionId));

    // Фильтр продолжает с последней записанной точки: если пауза вышла
    // долгой, он сам порвёт трек — это его работа, а не наша.
    filterState = { last: restored.last };
    pendingPoints = [];
    lastAcceptedAt = restored.last?.timestamp ?? 0;
    autoState = restored.last
      ? {
          anchor: restored.last,
          anchorAt: restored.last.timestamp,
          lastMoveAt: restored.last.timestamp,
        }
      : null;

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

    // Точки, накопленные, пока приложения не было, идут обычным путём:
    // observe сам решит, продолжается прогулка или между ними была пауза
    // в полчаса и её пора закрывать.
    try {
      for (const point of drainInbox()) get().observe(point);
    } catch (error) {
      console.warn('[walk] не удалось разобрать очередь', error);
    }

    // Прогулку, забытую со вчера, не продолжаем, а доводим до конца
    // обычным путём — с начислением опыта за пройденное.
    if (!isWalkResumable(active)) void get().stop();
  },

  saveIdentity: (name, avatar) => {
    // Через store, а не прямой записью в базу: имя показывают карта,
    // профиль и шапка, и все три должны увидеть его сразу, а не после
    // следующего перерисовывания по другому поводу.
    repo.updateProfile({ displayName: name, avatar });
    set({ displayName: name, avatar });
  },

  dismissToast: () => set({ toast: null }),
}));

/**
 * Открыть прогулку: и когда её объявил детектор, и когда её запустили руками
 * из дев-панели. Один путь на оба случая — иначе они разъедутся в мелочах
 * вроде «записали сессию, но забыли сбросить фильтр».
 */
function openWalk(
  source: string,
  startedAt: number,
  set: (partial: Partial<WalkState>) => void,
): void {
  const sessionId = `w-${Date.now().toString(36)}`;

  sessionSource = source;
  filterState = initialFilterState;
  pendingPoints = [];
  lastAcceptedAt = 0;
  resetPublisher();

  set({
    status: 'tracking',
    sessionId,
    startedAt,
    distanceM: 0,
    newCells: 0,
    acceptedPoints: 0,
    rejectedPoints: 0,
    liveSegment: [],
    segmentIndex: 0,
  });

  // Сессия создаётся ДО первой точки: писать их иначе некуда.
  // Ночная она или нет — определится по первой точке.
  repo.createSession(sessionId, startedAt, source, false);

  // Запись переживает выгрузку приложения: iOS может убить процесс
  // и поднять его заново только ради пачки координат.
  saveActiveWalk({ sessionId, startedAt, source });

  // Переключаем трекер на прогулочную передачу: точнее и чаще.
  void provider
    ?.start(WALK_TRACKING_OPTIONS)
    .then(() => set({ background: provider?.isBackgroundActive?.() ?? false }))
    .catch((error: unknown) => console.warn('[walk] не удалось поднять точность', error));
}

/**
 * Догнать ачивки при запуске.
 *
 * Правила считаются в конце прогулки, и этого достаточно, пока набор
 * не меняется. Но стоит добавить новую ачивку — и человек, давно прошедший
 * её условие, узнаёт об этом только после следующего выхода на улицу.
 * Пересчёт при старте закрывает этот разрыв: заслуженное приходит сразу.
 */
function catchUpAchievements(
  set: (partial: Partial<WalkState>) => void,
  get: () => WalkState,
): void {
  const snapshot = repo.buildSnapshot(repo.countCells() || 1);
  const { newlyUnlocked, xpAwarded } = evaluate(snapshot, repo.unlockedAchievements());
  if (newlyUnlocked.length === 0) return;

  for (const achievement of newlyUnlocked) {
    repo.unlockAchievement(achievement.code, Date.now());
    // Без ссылки на сессию: эта ачивка не заработана конкретной прогулкой,
    // она догнала человека за всё прошлое разом.
    repo.appendXpEvent('achievement', achievement.xpReward, achievement.code, null);
  }

  const profile = repo.getProfile();
  const next = applyXp({ level: profile.level, xp: profile.xp } satisfies LevelState, xpAwarded);
  repo.updateProfile({ level: next.level, xp: next.xp });

  set({
    level: next.level,
    xp: next.xp,
    toast: buildToast(newlyUnlocked, next.levelUps) ?? get().toast,
  });
}

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
