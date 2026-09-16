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

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

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

/** Мост между headless-таском и инстансом провайдера в JS-контексте приложения. */
const backgroundEmitter = new Emitter<GeoPoint>();

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
  for (const location of locations) {
    backgroundEmitter.emit(toGeoPoint(location));
  }
});

export class ExpoLocationProvider implements TrackingProvider {
  readonly id = 'expo-location' as const;
  readonly label = 'expo-location (бесплатно)';

  private status: TrackingStatus = 'idle';
  private foregroundSub: Location.LocationSubscription | null = null;
  private pointEmitter = new Emitter<GeoPoint>();
  private statusEmitter = new Emitter<TrackingStatus>();
  private unsubscribeBackground: (() => void) | null = null;

  getStatus(): TrackingStatus {
    return this.status;
  }

  async requestPermissions(): Promise<PermissionResult> {
    const foreground = await Location.requestForegroundPermissionsAsync();
    if (foreground.status !== 'granted') {
      return { level: 'denied', blocked: !foreground.canAskAgain };
    }

    // «Always» запрашивается ОТДЕЛЬНО и осознанно поздно — после первой
    // успешной прогулки. Спрошенное на онбординге даёт кратно меньше согласий.
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
      this.foregroundSub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: options.distanceFilterM,
          timeInterval: 3000,
        },
        (location) => this.pointEmitter.emit(toGeoPoint(location)),
      );

      if (options.background) {
        this.unsubscribeBackground = backgroundEmitter.subscribe((point) =>
          this.pointEmitter.emit(point),
        );

        const alreadyRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TASK);
        if (!alreadyRunning) {
          await Location.startLocationUpdatesAsync(BACKGROUND_TASK, {
            accuracy: Location.Accuracy.BestForNavigation,
            distanceInterval: options.distanceFilterM,
            // Копим точки пачками: каждое пробуждение JS стоит батареи.
            deferredUpdatesInterval: 30_000,
            deferredUpdatesDistance: 100,
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
      }

      this.setStatus('tracking');
    } catch (error) {
      console.warn('[tracking] start failed', error);
      this.setStatus('error');
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.foregroundSub?.remove();
    this.foregroundSub = null;
    this.unsubscribeBackground?.();
    this.unsubscribeBackground = null;

    if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TASK)) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_TASK);
    }
    this.setStatus('idle');
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
