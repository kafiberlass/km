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

/**
 * Две передачи трекера.
 *
 * Кнопки «начать прогулку» больше нет: приложение само решает, когда
 * человек пошёл. Значит, геолокация слушается всегда — а слушать её
 * круглосуточно с навигационной точностью означает съесть батарею
 * к обеду. Отсюда две передачи с разной ценой.
 *
 * `idle` — дежурный режим: грубая точность, редкие точки. Его задача
 * одна: заметить, что человек ушёл от дома на сотню метров.
 * `walk` — запись прогулки: максимальная точность, частые точки,
 * из них рисуется тропа и считаются ячейки.
 */
export type TrackingMode = 'idle' | 'walk';

export interface TrackingOptions {
  mode: TrackingMode;
  /** Минимальное смещение между точками, метры. Главный рычаг батареи. */
  distanceFilterM: number;
  /** Нужны ли обновления при свёрнутом приложении. */
  background: boolean;
  /** Текст постоянной нотификации Android. */
  notificationTitle: string;
  notificationBody: string;
}

export const WALK_TRACKING_OPTIONS: TrackingOptions = {
  mode: 'walk',
  distanceFilterM: 15,
  background: true,
  notificationTitle: 'КМ записывает прогулку',
  notificationBody: 'Карта открывается по мере движения',
};

/**
 * Дежурный режим. 60 метров и грубая точность — этого хватает порогу
 * в 120 метров из autoWalk.ts и не заставляет приёмник работать всё время.
 */
export const IDLE_TRACKING_OPTIONS: TrackingOptions = {
  mode: 'idle',
  distanceFilterM: 60,
  background: true,
  notificationTitle: 'КМ ждёт прогулку',
  notificationBody: 'Запись включится сама, когда вы пойдёте',
};

export const DEFAULT_TRACKING_OPTIONS = WALK_TRACKING_OPTIONS;

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
  /** Немедленно отдать накопленное в фоне — перед закрытием прогулки. */
  flush?(): void;
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
