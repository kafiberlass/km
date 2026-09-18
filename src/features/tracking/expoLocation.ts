/**
 * Бесплатная реализация фоновой геолокации на expo-location.
 *
 * Честно про ограничения (см. README, раздел «Геолокация»):
 *  - нет детекта остановки: трекинг не выключится сам, когда вы сели в кафе;
 *  - нет activity recognition: поездку от прогулки отличает только фильтр
 *    по скорости в core/geo/filter.ts;
 *  - на Android OEM-киллеры (Xiaomi, Huawei, Oppo) убивают процесс несмотря
 *    на foreground service — нужен экран про отключение оптимизации батареи;
 *  - на iOS после терминации приложение поднимает только Significant Location
 *    Change, а его точность — километры.
 *
 * Всё это решает react-native-background-geolocation (см. transistor.ts),
 * которая бесплатна в debug-сборках и требует лицензию только для релиза.
 */

import { AppState, type AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { appendInboxPoints, drainInbox } from '@/core/db/inbox';

import {
  DEFAULT_TRACKING_OPTIONS,
  Emitter,
  type GeoPoint,
  type PermissionResult,
  type TrackingOptions,
  type TrackingProvider,
  type TrackingStatus,
} from './types';

export const BACKGROUND_TASK = 'km-background-location';

/**
 * Сигнал «в очереди появились точки».
 *
 * Именно сигнал, а не сами координаты: таск может отработать в контексте,
 * где приложения ещё нет и слушать некому. Точки он кладёт в базу,
 * а разбирает их тот, кто жив.
 */
const inboxSignal = new Emitter<void>();

function toGeoPoint(location: Location.LocationObject): GeoPoint {
  return {
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    accuracy: location.coords.accuracy ?? Number.POSITIVE_INFINITY,
    speed: location.coords.speed,
    heading: location.coords.heading,
    altitude: location.coords.altitude,
    timestamp: location.timestamp,
    isMock: (location as { mocked?: boolean }).mocked === true,
  };
}

// Таск обязан определяться на верхнем уровне модуля: ОС поднимает JS-контекст
// заново и ищет его по имени ещё до того, как отрисуется первый экран.
TaskManager.defineTask(BACKGROUND_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[tracking] background task error', error);
    return;
  }
  const locations = (data as { locations?: Location.LocationObject[] } | null)?.locations ?? [];
  if (locations.length === 0) return;

  try {
    // Сначала в базу — приложение могут выгрузить прямо на этой строке.
    appendInboxPoints(locations.map(toGeoPoint));
  } catch (err) {
    console.warn('[tracking] не удалось записать фоновые точки', err);
    return;
  }

  inboxSignal.emit();
});

export class ExpoLocationProvider implements TrackingProvider {
  readonly id = 'expo-location' as const;
  readonly label = 'expo-location (бесплатно)';

  private status: TrackingStatus = 'idle';
  private foregroundSub: Location.LocationSubscription | null = null;
  private pointEmitter = new Emitter<GeoPoint>();
  private statusEmitter = new Emitter<TrackingStatus>();
  private unsubscribeInbox: (() => void) | null = null;
  private appStateSub: { remove: () => void } | null = null;
  private background = false;
  private draining = false;

  getStatus(): TrackingStatus {
    return this.status;
  }

  /** Идёт ли запись при свёрнутом приложении, или только пока экран открыт. */
  isBackgroundActive(): boolean {
    return this.background;
  }

  async requestPermissions(): Promise<PermissionResult> {
    const foreground = await Location.requestForegroundPermissionsAsync();
    if (foreground.status !== 'granted') {
      return { level: 'denied', blocked: !foreground.canAskAgain };
    }

    // «Always» запрашивается ОТДЕЛЬНО: iOS сначала даёт «При использовании»,
    // а потом, когда приложение действительно поработало в фоне, сам
    // предлагает переключить. Спрошенное на онбординге даёт кратно
    // меньше согласий.
    const background = await Location.requestBackgroundPermissionsAsync();
    return {
      level: background.status === 'granted' ? 'always' : 'when-in-use',
      blocked: !background.canAskAgain && background.status !== 'granted',
    };
  }

  async start(partial: Partial<TrackingOptions> = {}): Promise<void> {
    const options: TrackingOptions = { ...DEFAULT_TRACKING_OPTIONS, ...partial };
    this.setStatus('starting');

    try {
      const permission = await Location.getBackgroundPermissionsAsync().catch(() => null);
      const canBackground = options.background && permission?.status === 'granted';

      if (canBackground) {
        // Источник координат ровно один. Раньше рядом с фоновым таском
        // работал ещё и watchPositionAsync, и каждая точка приходила
        // дважды: половину съедал фильтр дрожания, остальные накручивали
        // счётчик отсеянных и путали дев-панель.
        await this.startBackgroundUpdates(options);
        this.background = true;

        // Догоняем то, что накопилось, пока приложение было выгружено.
        this.drainInboxNow();
      } else {
        this.foregroundSub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            distanceInterval: options.distanceFilterM,
            timeInterval: 3000,
          },
          (location) => this.pointEmitter.emit(toGeoPoint(location)),
        );
        this.background = false;
      }

      this.setStatus('tracking');
    } catch (error) {
      console.warn('[tracking] start failed', error);
      this.setStatus('error');
      throw error;
    }
  }

  async stop(): Promise<void> {
    // Сначала разбираем очередь: последние метры прогулки могли прийти
    // за секунду до нажатия «завершить», и терять их обидно.
    this.drainInboxNow();

    this.foregroundSub?.remove();
    this.foregroundSub = null;
    this.unsubscribeInbox?.();
    this.unsubscribeInbox = null;
    this.appStateSub?.remove();
    this.appStateSub = null;
    this.background = false;

    if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TASK)) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_TASK);
    }
    this.setStatus('idle');
  }

  private async startBackgroundUpdates(options: TrackingOptions): Promise<void> {
    this.unsubscribeInbox = inboxSignal.subscribe(() => this.drainInboxNow());

    // Пока приложение спало, сигнал мог прийти в никуда: подписка живёт
    // в памяти, а её пересоздали при пробуждении. Возврат на экран —
    // второй, независимый повод заглянуть в очередь.
    this.appStateSub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') this.drainInboxNow();
    });

    if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TASK)) return;

    await Location.startLocationUpdatesAsync(BACKGROUND_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      distanceInterval: options.distanceFilterM,
      // Копим точки пачками: каждое пробуждение JS стоит батареи. Но
      // отложенные точки лежат в памяти нативного слоя, и если iOS убьёт
      // приложение, буфер пропадёт вместе с ним — поэтому пачки небольшие.
      // Условия действуют только в фоне: на открытом экране iOS отдаёт
      // точки сразу, и тропа рисуется живой.
      deferredUpdatesInterval: 20_000,
      deferredUpdatesDistance: 50,
      // iOS умеет «приостановить обновления, когда человек не двигается»
      // и не включает их обратно, пока приложение не откроют. Для записи
      // прогулки это тихая потеря второй половины пути.
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.Fitness,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: options.notificationTitle,
        notificationBody: options.notificationBody,
        notificationColor: '#E4713F',
        killServiceOnDestroy: false,
      },
    });
  }

  /** Разбор очереди. Повторный вызов во время разбора игнорируется. */
  private drainInboxNow(): void {
    if (this.draining) return;
    this.draining = true;
    try {
      for (const point of drainInbox()) this.pointEmitter.emit(point);
    } catch (error) {
      console.warn('[tracking] не удалось разобрать очередь точек', error);
    } finally {
      this.draining = false;
    }
  }

  subscribe(listener: (point: GeoPoint) => void): () => void {
    return this.pointEmitter.subscribe(listener);
  }

  onStatusChange(listener: (status: TrackingStatus) => void): () => void {
    return this.statusEmitter.subscribe(listener);
  }

  private setStatus(status: TrackingStatus): void {
    this.status = status;
    this.statusEmitter.emit(status);
  }
}
