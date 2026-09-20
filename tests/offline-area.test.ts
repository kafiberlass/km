import { describe, expect, it } from 'vitest';

import {
  OFFLINE_MAX_ZOOM,
  OFFLINE_MIN_ZOOM,
  boundsAround,
  countTiles,
  estimateBytes,
  formatSize,
} from '@/features/map/offlineArea';

const KAZAN = { lat: 55.7963, lng: 49.1088 };
const EQUATOR = { lat: 0, lng: 0 };

describe('границы вокруг дома', () => {
  it('дом внутри области, и она симметрична', () => {
    const [west, south, east, north] = boundsAround(KAZAN, 5);

    expect(west).toBeLessThan(KAZAN.lng);
    expect(east).toBeGreaterThan(KAZAN.lng);
    expect(south).toBeLessThan(KAZAN.lat);
    expect(north).toBeGreaterThan(KAZAN.lat);
    expect(KAZAN.lng - west).toBeCloseTo(east - KAZAN.lng, 9);
  });

  it('пять километров по широте — это примерно 0.045 градуса', () => {
    const [, south, , north] = boundsAround(KAZAN, 5);
    expect((north - south) / 2).toBeCloseTo(0.045, 3);
  });

  it('на севере область шире по долготе, чем на экваторе', () => {
    const [westKazan, , eastKazan] = boundsAround(KAZAN, 5);
    const [westEquator, , eastEquator] = boundsAround(EQUATOR, 5);

    // Градус долготы на широте Казани почти вдвое короче, поэтому
    // та же пятёрка километров занимает больше градусов.
    expect(eastKazan - westKazan).toBeGreaterThan((eastEquator - westEquator) * 1.5);
  });

  it('у полюса и у края мира координаты не выезжают за пределы', () => {
    const [west, south, east, north] = boundsAround({ lat: 84, lng: 179.9 }, 200);
    expect(west).toBeGreaterThanOrEqual(-180);
    expect(east).toBeLessThanOrEqual(180);
    expect(south).toBeGreaterThanOrEqual(-85);
    expect(north).toBeLessThanOrEqual(85);
  });
});

describe('сколько это весит', () => {
  it('район города — десятки мегабайт, а не гигабайты', () => {
    const tiles = countTiles(boundsAround(KAZAN, 5));
    const bytes = estimateBytes(tiles);

    expect(bytes).toBeGreaterThan(5 * 1024 * 1024);
    expect(bytes).toBeLessThan(300 * 1024 * 1024);
  });

  it('больше радиус — больше тайлов', () => {
    expect(countTiles(boundsAround(KAZAN, 10))).toBeGreaterThan(
      countTiles(boundsAround(KAZAN, 3)),
    );
  });

  it('каждый следующий масштаб дороже предыдущего примерно вчетверо', () => {
    const bounds = boundsAround(KAZAN, 5);
    const upTo15 = countTiles(bounds, OFFLINE_MIN_ZOOM, 15);
    const upTo16 = countTiles(bounds, OFFLINE_MIN_ZOOM, OFFLINE_MAX_ZOOM);

    expect(upTo16).toBeGreaterThan(upTo15 * 2);
  });

  it('размер читается по-человечески', () => {
    expect(formatSize(400 * 1024)).toBe('400 КБ');
    expect(formatSize(12.5 * 1024 * 1024)).toBe('12.5 МБ');
    expect(formatSize(250 * 1024 * 1024)).toBe('250 МБ');
  });
});
