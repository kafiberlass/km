import { describe, expect, it } from 'vitest';

import { LAND_RINGS } from '@/features/globe/land';
import {
  GLOBE_ZOOM_FULL,
  GLOBE_ZOOM_NONE,
  globeOpacity,
  graticule,
  projectGlobe,
  ringVisible,
  type GlobeView,
} from '@/features/globe/projection';

const view: GlobeView = { cx: 200, cy: 400, r: 150, lng0: 0, lat0: 0 };

describe('проекция глобуса', () => {
  it('центр обзора попадает в центр диска', () => {
    const p = projectGlobe(view.lng0, view.lat0, view);
    expect(p.x).toBeCloseTo(view.cx, 6);
    expect(p.y).toBeCloseTo(view.cy, 6);
    expect(p.front).toBe(true);
  });

  it('север — вверх, восток — вправо', () => {
    const north = projectGlobe(0, 90, view);
    expect(north.x).toBeCloseTo(view.cx, 6);
    expect(north.y).toBeCloseTo(view.cy - view.r, 6);

    const east = projectGlobe(90, 0, view);
    expect(east.x).toBeCloseTo(view.cx + view.r, 6);
    expect(east.y).toBeCloseTo(view.cy, 6);
  });

  it('обратная сторона планеты помечается и прижимается к краю диска', () => {
    const behind = projectGlobe(150, 0, view);
    expect(behind.front).toBe(false);
    const distance = Math.hypot(behind.x - view.cx, behind.y - view.cy);
    expect(distance).toBeCloseTo(view.r, 6);
  });

  it('ни одна точка мира не вылезает за диск', () => {
    const tilted: GlobeView = { ...view, lng0: 37.6, lat0: 55.7 };
    for (let lat = -90; lat <= 90; lat += 3) {
      for (let lng = -180; lng < 180; lng += 3) {
        const p = projectGlobe(lng, lat, tilted);
        const distance = Math.hypot(p.x - tilted.cx, p.y - tilted.cy);
        // Допуск на арифметику с плавающей точкой, не на геометрию.
        expect(distance).toBeLessThanOrEqual(tilted.r + 1e-9);
      }
    }
  });

  it('видимость кольца считается по лицевой стороне', () => {
    const ring = [150, 0, 160, 10, 170, -10];
    expect(ringVisible(ring, view)).toBe(false);
    expect(ringVisible(ring, { ...view, lng0: 160 })).toBe(true);
  });
});

describe('перетекание карты в планету', () => {
  it('на максимальном отдалении видна только планета', () => {
    expect(globeOpacity(0)).toBe(1);
    expect(globeOpacity(GLOBE_ZOOM_FULL)).toBe(1);
  });

  it('на городских масштабах планеты нет', () => {
    expect(globeOpacity(GLOBE_ZOOM_NONE)).toBe(0);
    expect(globeOpacity(15)).toBe(0);
  });

  it('между границами прозрачность растёт монотонно при отдалении', () => {
    let previous = 0;
    for (let zoom = GLOBE_ZOOM_NONE; zoom >= GLOBE_ZOOM_FULL; zoom -= 0.1) {
      const value = globeOpacity(zoom);
      expect(value).toBeGreaterThanOrEqual(previous - 1e-9);
      expect(value).toBeLessThanOrEqual(1);
      previous = value;
    }
  });
});

describe('данные суши', () => {
  it('кольца непустые и координаты в пределах мира', () => {
    expect(LAND_RINGS.length).toBeGreaterThan(50);
    for (const ring of LAND_RINGS) {
      expect(ring.length % 2).toBe(0);
      expect(ring.length).toBeGreaterThanOrEqual(8);
      for (let i = 0; i < ring.length; i += 2) {
        expect(Math.abs(ring[i]!)).toBeLessThanOrEqual(180);
        expect(Math.abs(ring[i + 1]!)).toBeLessThanOrEqual(90);
      }
    }
  });

  it('Евразия видна с Москвы', () => {
    const moscow: GlobeView = { ...view, lng0: 37.6, lat0: 55.7 };
    const visible = LAND_RINGS.filter((ring) => ringVisible(ring, moscow));
    expect(visible.length).toBeGreaterThan(5);
  });

  it('сетка параллелей и меридианов замкнута по миру', () => {
    const lines = graticule(30);
    expect(lines.length).toBe(12 + 5);
    for (const line of lines) expect(line.length % 2).toBe(0);
  });
});
