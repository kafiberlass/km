/**
 * Обёртка над react-native-background-geolocation (transistorsoft).
 *
 * ЛИЦЕНЗИЯ: библиотека платная (~$300 за платформу), но в DEBUG-сборках
 * работает без ограничений. Пока приложение не выкладывается в сторы,
 * пользоваться ей можно и нужно — качество фонового трекинга несопоставимо
 * с expo-location. Лицензия понадобится к первому релизу.
 *
 * Пакета нет в package.json. Чтобы включить:
 *   npx expo install react-native-background-geolocation
 *   npx expo prebuild --clean
 * Файл написан через require и локальные типы, поэтому проект собирается
 * и тайпчекается и без установленного пакета.
 */

import {
  DEFAULT_TRACKING_OPTIONS,
  Emitter,
  type GeoPoint,
  type PermissionResult,
  type TrackingOptions,
  type TrackingProvider,
  type TrackingStatus,
} from './types';

interface BgLocation {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    speed: number;
    heading: number;
    altitude: number;
  };
  timestamp: string;
  is_moving: boolean;
  mock?: boolean;
}

interface BgModule {
  ready(config: Record<string, unknown>): Promise<{ enabled: boolean }>;
  start(): Promise<unknown>;
  stop(): Promise<unknown>;
  onLocation(cb: (location: BgLocation) => void, err?: (code: number) => void): { remove(): void };
  onProviderChange(cb: (event: { status: number }) => void): { remove(): void };
  requestPermission(): Promise<number>;
  DESIRED_ACCURACY_NAVIGATION: number;
  AUTHORIZATION_STATUS_ALWAYS: number;
  AUTHORIZATION_STATUS_WHEN_IN_USE: number;
  LOG_LEVEL_VERBOSE: number;
}

function loadModule(): BgModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('react-native-background-geolocation');
  return (mod.default ?? mod) as BgModule;
}

export class TransistorProvider implements TrackingProvider {
  readonly id = 'transistor' as const;
  readonly label = 'background-geolocation (dev-лицензия)';

  private bg: BgModule = loadModule();
  private status: TrackingStatus = 'idle';
  private subscriptions: { remove(): void }[] = [];
  private pointEmitter = new Emitter<GeoPoint>();
  private statusEmitter = new Emitter<TrackingStatus>();

  getStatus(): TrackingStatus {
    return this.status;
  }

  async requestPermissions(): Promise<PermissionResult> {
    const status = await this.bg.requestPermission();
    if (status === this.bg.AUTHORIZATION_STATUS_ALWAYS) {
      return { level: 'always', blocked: false };
    }
    if (status === this.bg.AUTHORIZATION_STATUS_WHEN_IN_USE) {
      return { level: 'when-in-use', blocked: false };
    }
    return { level: 'denied', blocked: true };
  }

  async start(partial: Partial<TrackingOptions> = {}): Promise<void> {
    const options: TrackingOptions = { ...DEFAULT_TRACKING_OPTIONS, ...partial };
    this.setStatus('starting');

    this.subscriptions.push(
      this.bg.onLocation(
        (location) => this.pointEmitter.emit(this.toGeoPoint(location)),
        (code) => {
          console.warn('[tracking] location error', code);
          this.setStatus('error');
        },
      ),
    );

    await this.bg.ready({
      desiredAccuracy: this.bg.DESIRED_ACCURACY_NAVIGATION,
      distanceFilter: options.distanceFilterM,
      // Ради этих четырёх строк библиотека и покупается: остановка,
      // автоперезапуск и разумное поведение батареи из коробки.
      stopTimeout: 5,
      stopOnTerminate: false,
      startOnBoot: true,
      preventSuspend: false,
      foregroundService: true,
      notification: {
        title: options.notificationTitle,
        text: options.notificationBody,
        color: '#E4713F',
      },
      backgroundPermissionRationale: {
        title: 'Разрешить доступ к геопозиции всегда?',
        message: 'Иначе карта перестанет открываться, когда приложение свёрнуто.',
        positiveAction: 'Разрешить',
      },
      debug: false,
      logLevel: this.bg.LOG_LEVEL_VERBOSE,
    });

    await this.bg.start();
    this.setStatus('tracking');
  }

  async stop(): Promise<void> {
    await this.bg.stop();
    for (const sub of this.subscriptions) sub.remove();
    this.subscriptions = [];
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

  private toGeoPoint(location: BgLocation): GeoPoint {
    return {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      accuracy: location.coords.accuracy,
      speed: location.coords.speed,
      heading: location.coords.heading,
      altitude: location.coords.altitude,
      timestamp: Date.parse(location.timestamp),
      isMock: location.mock === true,
    };
  }
}
