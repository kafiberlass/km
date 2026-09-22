import { describe, expect, it } from 'vitest';

import { LAND_RINGS } from '@/features/globe/land';
import { LAND_UNITS } from '@/features/globe/landUnits';
import {
  GLOBE_SCALE_FAR,
  GLOBE_SCALE_NEAR,
  GLOBE_ZOOM_FULL,
  GLOBE_ZOOM_NONE,
  GLOBE_ZOOM_START,
  SPACE_ZOOM_FULL,
  globeMarkers,
  globeOpacity,
  globeScale,
  globeTrig,
  graticule,
  projectGlobe,
  globeBackdropRadius,
  projectUnit,
  skyRadius,
  unitOf,
  smoothstep,
  spreadMarkers,
  spaceOpacity,
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

describe('две фазы перехода', () => {
  // Главное свойство: сквозь планету не должно просвечивать карту.
  // Держит это подложка — круг, который проявляется вместе с шаром.
  it('под шаром всегда есть своя подложка', () => {
    for (let zoom = GLOBE_ZOOM_NONE + 1; zoom >= 0; zoom -= 0.05) {
      if (globeOpacity(zoom) === 0) continue;
      expect(globeBackdropRadius(zoom, DISC)).toBeGreaterThanOrEqual(DISC * globeScale(zoom));
    }
  });

  it('шар начинает проявляться сразу, а не после чёрного экрана', () => {
    expect(GLOBE_ZOOM_START).toBeLessThan(GLOBE_ZOOM_NONE);
    expect(spaceOpacity(SPACE_ZOOM_FULL)).toBe(1);
    expect(globeOpacity(GLOBE_ZOOM_START)).toBe(0);
  });

  it('небо гаснет обратно на городских масштабах', () => {
    expect(spaceOpacity(GLOBE_ZOOM_NONE)).toBe(0);
    expect(spaceOpacity(15)).toBe(0);
  });

  it('шар ведёт себя как предмет: ближе — крупнее', () => {
    // Главное свойство: на всём диапазоне приближение только увеличивает
    // планету. Обратное и выглядело как «лечу к ней, а она исчезает».
    let previous = 0;
    for (let zoom = 0; zoom <= GLOBE_ZOOM_START; zoom += 0.05) {
      const value = globeScale(zoom);
      expect(value).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = value;
    }
  });

  it('на краю отдаления Земля дальше всего, у границы с картой — ближе всего', () => {
    expect(globeScale(0)).toBeCloseTo(GLOBE_SCALE_FAR, 6);
    expect(globeScale(GLOBE_ZOOM_FULL)).toBeCloseTo(1, 6);
    expect(globeScale(GLOBE_ZOOM_START)).toBeCloseTo(GLOBE_SCALE_NEAR, 6);
    expect(GLOBE_SCALE_NEAR).toBeGreaterThan(1);
  });

  it('за границами диапазона масштаб не скачет', () => {
    expect(globeScale(-1)).toBeCloseTo(GLOBE_SCALE_FAR, 6);
    expect(globeScale(15)).toBeCloseTo(GLOBE_SCALE_NEAR, 6);
  });

  it('сглаживание зажато в границы и плавное на концах', () => {
    expect(smoothstep(-1)).toBe(0);
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(0.5)).toBeCloseTo(0.5, 6);
    expect(smoothstep(1)).toBe(1);
    expect(smoothstep(2)).toBe(1);
    // У линейного проявления виден момент старта, у сглаженного — нет.
    expect(smoothstep(0.1)).toBeLessThan(0.1);
    expect(smoothstep(0.9)).toBeGreaterThan(0.9);
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

  it('с Москвы видна суша вокруг', () => {
    const moscow: GlobeView = { ...view, lng0: 37.6, lat0: 55.7 };
    // Берём по одной точке от каждого кольца: если ни одна не попала
    // на видимую половину, значит, планета повёрнута не той стороной.
    const visible = globeMarkers(
      LAND_RINGS.map((ring) => ({ lng: ring[0]!, lat: ring[1]! })),
      moscow,
      (item) => item,
    );
    expect(visible.length).toBeGreaterThan(5);
  });

  it('сетка параллелей и меридианов замкнута по миру', () => {
    const lines = graticule(30);
    expect(lines.length).toBe(12 + 5);
    for (const line of lines) expect(line.length % 2).toBe(0);
  });
});

describe('метки на планете', () => {
  const items = [
    { id: 'рядом', position: { lng: 5, lat: 5 } },
    { id: 'за горизонтом', position: { lng: 160, lat: 0 } },
    { id: 'без позиции', position: null },
  ];

  it('рисуются только те, кто на видимой половине', () => {
    const markers = globeMarkers(items, view, (item) => item.position);
    expect(markers.map((marker) => marker.item.id)).toEqual(['рядом']);
  });

  it('метка попадает внутрь диска', () => {
    const [marker] = globeMarkers(items, view, (item) => item.position);
    const distance = Math.hypot(marker!.x - view.cx, marker!.y - view.cy);
    expect(distance).toBeLessThan(view.r);
  });

  it('поворот планеты меняет состав видимых меток', () => {
    const markers = globeMarkers(items, { ...view, lng0: 160 }, (item) => item.position);
    expect(markers.map((marker) => marker.item.id)).toEqual(['за горизонтом']);
  });
});

/** Телефон 390×844: половина диагонали и радиус диска планеты. */
const COVER = Math.hypot(390, 844) / 2;
const DISC = (Math.min(390, 844) * 0.82) / 2;

describe('переход карта — планета', () => {
  it('карта видна, пока небо не разрослось', () => {
    // Смысл всей переделки: между «карта погасла» и «шар появился»
    // не должно быть кадра, где не видно ни того ни другого.
    expect(skyRadius(GLOBE_ZOOM_NONE, COVER)).toBe(0);
    expect(skyRadius(4.6, COVER)).toBeLessThan(COVER);
  });

  it('к концу перехода небо накрывает углы экрана', () => {
    expect(skyRadius(SPACE_ZOOM_FULL, COVER)).toBeGreaterThanOrEqual(COVER);
    expect(skyRadius(2.5, COVER)).toBeGreaterThanOrEqual(COVER);
  });

  it('подложка под шаром всегда не меньше самого шара', () => {
    // Иначе по краю планеты просвечивает карта — два изображения разом.
    for (let zoom = 0; zoom <= 5; zoom += 0.05) {
      expect(globeBackdropRadius(zoom, DISC)).toBeGreaterThanOrEqual(DISC * globeScale(zoom));
    }
  });

  it('в середине экрана никогда не бывает пусто', () => {
    // Раньше между «карта погасла» и «шар появился» был кадр, где не
    // видно ни того ни другого: пустой синий экран.
    for (let zoom = 0; zoom <= GLOBE_ZOOM_NONE; zoom += 0.05) {
      const darkCircle = skyRadius(zoom, COVER);
      const planet = globeOpacity(zoom) > 0;
      const mapVisible = darkCircle < COVER;

      expect(planet || mapVisible).toBe(true);
    }
  });
});

describe('быстрая проекция', () => {
  const view = { cx: 200, cy: 400, r: 160, lng0: 49, lat0: 55.8 };

  /** Прямой счёт по определению ортографической проекции — как было раньше. */
  function naive(lng: number, lat: number) {
    const RAD = Math.PI / 180;
    const phi = lat * RAD;
    const phi0 = view.lat0 * RAD;
    const d = (lng - view.lng0) * RAD;

    const cosC = Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * Math.cos(phi) * Math.cos(d);
    let x = Math.cos(phi) * Math.sin(d);
    let y = Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * Math.cos(phi) * Math.cos(d);

    const front = cosC >= 0;
    if (!front) {
      const len = Math.hypot(x, y);
      if (len > 0) {
        x /= len;
        y /= len;
      }
    }
    return { x: view.cx + x * view.r, y: view.cy - y * view.r, front };
  }

  it('совпадает с прямым счётом по всей планете', () => {
    // Оптимизация вынесла синусы из точки наружу; если алгебра разъехалась,
    // материки поедут, и заметно это будет уже на телефоне.
    const trig = globeTrig(view);

    for (let lng = -180; lng <= 180; lng += 17) {
      for (let lat = -85; lat <= 85; lat += 11) {
        const [a, b, c] = unitOf(lng, lat);
        const fast = projectUnit(a, b, c, trig, view);
        const slow = naive(lng, lat);

        expect(fast.front).toBe(slow.front);
        expect(fast.x).toBeCloseTo(slow.x, 9);
        expect(fast.y).toBeCloseTo(slow.y, 9);
      }
    }
  });

  it('вся суша переведена в векторы — по три числа на точку', () => {
    expect(LAND_UNITS.length).toBe(LAND_RINGS.length);
    for (let i = 0; i < LAND_RINGS.length; i += 1) {
      expect(LAND_UNITS[i]!.length).toBe((LAND_RINGS[i]!.length / 2) * 3);
    }
  });
});

describe('разведение слипшихся меток', () => {
  const GAP = 12;

  it('две метки в одной точке расходятся', () => {
    const spread = spreadMarkers([{ x: 100, y: 100 }, { x: 100.05, y: 100 }], GAP);
    const distance = Math.hypot(spread[0]!.x - spread[1]!.x, spread[0]!.y - spread[1]!.y);
    expect(distance).toBeGreaterThanOrEqual(GAP);
  });

  it('разведённые метки остаются вокруг общего места', () => {
    const spread = spreadMarkers([{ x: 100, y: 100 }, { x: 100, y: 100 }], GAP);
    for (const marker of spread) {
      // Половина зазора каждой: вместе это ровно зазор, а не два.
      expect(Math.hypot(marker.x - 100, marker.y - 100)).toBeCloseTo(GAP / 2, 6);
    }
  });

  it('метки не прыгают в тот момент, когда перестают быть слипшимися', () => {
    // Ровно этим и была плохая анимация при приближении: пока метки
    // считались слипшимися, их держали на одном расстоянии, а на границе
    // отпускали — и они скачком съезжались.
    const before = spreadMarkers([{ x: 100, y: 100 }, { x: 100 + GAP - 0.01, y: 100 }], GAP);
    const after = spreadMarkers([{ x: 100, y: 100 }, { x: 100 + GAP + 0.01, y: 100 }], GAP);

    for (let i = 0; i < before.length; i += 1) {
      expect(before[i]!.x).toBeCloseTo(after[i]!.x, 1);
      expect(before[i]!.y).toBeCloseTo(after[i]!.y, 1);
    }
  });

  it('чем дальше метки друг от друга, тем меньше их двигают', () => {
    const shift = (distance: number) => {
      const spread = spreadMarkers([{ x: 100, y: 100 }, { x: 100 + distance, y: 100 }], GAP);
      return Math.abs(spread[0]!.x - 100);
    };

    // Монотонно убывает до нуля: движение метки при приближении карты
    // должно быть плавным, а не ступенчатым.
    const shifts = [0, 2, 4, 6, 8, 10, GAP].map(shift);
    for (let i = 1; i < shifts.length; i += 1) {
      expect(shifts[i]!).toBeLessThanOrEqual(shifts[i - 1]! + 1e-9);
    }
    expect(shifts[shifts.length - 1]!).toBeCloseTo(0, 6);
  });

  it('далёкие метки не двигаются', () => {
    const items = [{ x: 10, y: 10 }, { x: 200, y: 200 }];
    expect(spreadMarkers(items, GAP)).toEqual(items);
  });

  it('одиночная метка остаётся на месте', () => {
    expect(spreadMarkers([{ x: 5, y: 7 }], GAP)).toEqual([{ x: 5, y: 7 }]);
  });

  it('прочие поля метки сохраняются', () => {
    const spread = spreadMarkers([
      { x: 0, y: 0, id: 'я' },
      { x: 0, y: 0, id: 'брат' },
    ], GAP);
    expect(spread.map((marker) => marker.id)).toEqual(['я', 'брат']);
  });
});
