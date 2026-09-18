/**
 * Интерфейс над источником координат.
 *
 * Смысл абстракции не в «красивой архитектуре», а в трёх конкретных вещах:
 *
 * 1. Dev: проигрывание GPX без выхода на улицу (MockProvider).
 * 2. Деньги: react-native-background-geolocation бесплатна только в debug.
 *    Пока лицензии нет, release едет на expo-location. Купили — поменяли
 *    одну константу, не трогая ни фичи, ни БД.
 * 3. Тесты: вся логика выше этого интерфейса проверяется без эмулятора.
 */

import type { GeoPoint } from '@/core/geo/filter';

export type { GeoPoint };

export type TrackingStatus = 'idle' | 'starting' | 'tracking' | 'paused' | 'error';

export type PermissionLevel = 'denied' | 'when-in-use' | 'always';

export interface PermissionResult {
  level: PermissionLevel;
  /** true, если ОС больше не покажет диалог и нужно вести в настройки. */
  blocked: boolean;
}

export interface TrackingOptions {
  /** Минимальное смещение между точками, метры. Главный рычаг батареи. */
  distanceFilterM: number;
  /** Нужны ли обновления при свёрнутом приложении. */
  background: boolean;
  /** Текст постоянной нотификации Android. */
  notificationTitle: string;
  notificationBody: string;
}

export const DEFAULT_TRACKING_OPTIONS: TrackingOptions = {
  distanceFilterM: 15,
  background: true,
  notificationTitle: 'КМ записывает прогулку',
  notificationBody: 'Карта открывается по мере движения',
};

export interface TrackingProvider {
  /** Идентификатор для логов и дев-панели. */
  readonly id: 'mock' | 'expo-location' | 'transistor';
  /** Человекочитаемое имя для дев-панели. */
  readonly label: string;

  getStatus(): TrackingStatus;
  /**
   * Идёт ли запись при свёрнутом приложении. Не у всех реализаций есть
   * фон (мок его не изображает), поэтому метод необязательный.
   */
  isBackgroundActive?(): boolean;
  requestPermissions(): Promise<PermissionResult>;
  start(options?: Partial<TrackingOptions>): Promise<void>;
  stop(): Promise<void>;

  /** Возвращает функцию отписки. */
  subscribe(listener: (point: GeoPoint) => void): () => void;
  onStatusChange(listener: (status: TrackingStatus) => void): () => void;
}

/** Общая для всех реализаций машинка подписок. */
export class Emitter<T> {
  private listeners = new Set<(value: T) => void>();

  subscribe(listener: (value: T) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(value: T): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(value);
      } catch (error) {
        console.warn('[tracking] listener failed', error);
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
