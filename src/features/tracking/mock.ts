/**
 * Проигрыватель GPX — главный инструмент разработки в этом проекте.
 *
 * Без него каждая проверка гипотезы про туман, XP или ачивки стоит получаса
 * на улице. С ним прогулка на 5 км проигрывается за 3 секунды на ×100.
 *
 * Проверяет ВСЮ JS-логику. Нативную часть (foreground service, поведение
 * после сворачивания) он не трогает — для неё нужен Lockito и подача
 * координат в саму систему, см. README.
 */

import { Emitter, type GeoPoint, type PermissionResult, type TrackingProvider, type TrackingStatus } from './types';
import { parseGpx } from '@/core/geo/gpx';

export interface MockOptions {
  /** Во сколько раз быстрее реального времени. */
  speedMultiplier: number;
  /** Зациклить трек. */
  loop: boolean;
  /** Добавить шум в координаты, метры — имитация плохого приёма. */
  jitterM: number;
  /** Доля точек, которым проставляется плохая точность. */
  badAccuracyRate: number;
}

export const DEFAULT_MOCK_OPTIONS: MockOptions = {
  speedMultiplier: 20,
  loop: false,
  jitterM: 0,
  badAccuracyRate: 0,
};

const METERS_PER_DEGREE_LAT = 111_320;

export class MockTrackingProvider implements TrackingProvider {
  readonly id = 'mock' as const;
  readonly label = 'GPX-плеер (dev)';

  private points: GeoPoint[] = [];
  private cursor = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private status: TrackingStatus = 'idle';
  private options: MockOptions = { ...DEFAULT_MOCK_OPTIONS };

  private pointEmitter = new Emitter<GeoPoint>();
  private statusEmitter = new Emitter<TrackingStatus>();

  /** Загрузить трек из строки GPX. Время пересчитывается от «сейчас». */
  loadGpx(xml: string, startedAt: number = Date.now()): number {
    const parsed = parseGpx(xml, { startedAt });
    if (parsed.length === 0) return 0;

    // Сдвигаем метки времени так, чтобы трек «заканчивался» сейчас:
    // иначе ачивка «после заката» будет считаться от даты записи файла.
    const first = parsed[0]!.timestamp;
    this.points = parsed.map((p) => ({ ...p, timestamp: startedAt + (p.timestamp - first) }));
    this.cursor = 0;
    return this.points.length;
  }

  loadPoints(points: GeoPoint[]): void {
    this.points = points;
    this.cursor = 0;
  }

  configure(options: Partial<MockOptions>): void {
    this.options = { ...this.options, ...options };
  }

  getStatus(): TrackingStatus {
    return this.status;
  }

  get progress(): { current: number; total: number } {
    return { current: this.cursor, total: this.points.length };
  }

  async requestPermissions(): Promise<PermissionResult> {
    return { level: 'always', blocked: false };
  }

  async start(): Promise<void> {
    if (this.points.length === 0) {
      throw new Error('MockTrackingProvider: трек не загружен');
    }
    this.setStatus('tracking');
    this.scheduleNext();
  }

  async stop(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.setStatus('idle');
  }

  /** Проиграть весь трек мгновенно — для тестов и для backfill. */
  flush(): GeoPoint[] {
    const emitted: GeoPoint[] = [];
    while (this.cursor < this.points.length) {
      const point = this.decorate(this.points[this.cursor]!);
      emitted.push(point);
      this.pointEmitter.emit(point);
      this.cursor += 1;
    }
    return emitted;
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

  private scheduleNext(): void {
    if (this.cursor >= this.points.length) {
      if (this.options.loop) {
        this.cursor = 0;
      } else {
        void this.stop();
        return;
      }
    }

    const point = this.points[this.cursor]!;
    const next = this.points[this.cursor + 1];
    const realGapMs = next ? next.timestamp - point.timestamp : 1000;
    const delay = Math.max(0, realGapMs / this.options.speedMultiplier);

    this.timer = setTimeout(() => {
      this.pointEmitter.emit(this.decorate(point));
      this.cursor += 1;
      if (this.status === 'tracking') this.scheduleNext();
    }, delay);
  }

  /** Шум и плохая точность — чтобы фильтр проверялся на реалистичных данных. */
  private decorate(point: GeoPoint): GeoPoint {
    const { jitterM, badAccuracyRate } = this.options;
    let result = point;

    if (jitterM > 0) {
      const dLat = ((Math.random() - 0.5) * 2 * jitterM) / METERS_PER_DEGREE_LAT;
      const dLng =
        ((Math.random() - 0.5) * 2 * jitterM) /
        (METERS_PER_DEGREE_LAT * Math.cos((point.lat * Math.PI) / 180));
      result = { ...result, lat: result.lat + dLat, lng: result.lng + dLng };
    }

    if (badAccuracyRate > 0 && Math.random() < badAccuracyRate) {
      result = { ...result, accuracy: 60 + Math.random() * 60 };
    }

    return result;
  }
}
