import { describe, expect, it } from 'vitest';

import {
  cameraMatrixWorklet,
  projectToScreenWorklet,
  createProjector,
  groundMetersToMercatorMeters,
  haversineMeters,
  lngLatToMercator,
  mercatorToLngLat,
  pixelsPerMercatorMeter,
} from '@/core/geo/mercator';
import { cellsAround, cellsAlongSegment, formatPercent } from '@/core/geo/coverage';
import { DEFAULT_FILTER, filterStep, filterTrack, initialFilterState } from '@/core/geo/filter';
import { parseGpx, toGpx } from '@/core/geo/gpx';
import { isAfterSunset, sunTimes } from '@/core/geo/sun';
import { WALK_CHISTYE_PRUDY_GPX } from '../assets/fixtures/walkChistyePrudy';

const MOSCOW = { lat: 55.7625, lng: 37.6425 };

describe('mercator', () => {
  it('round-trip проекции не теряет точность', () => {
    const back = mercatorToLngLat(lngLatToMercator(MOSCOW));
    expect(back.lat).toBeCloseTo(MOSCOW.lat, 9);
    expect(back.lng).toBeCloseTo(MOSCOW.lng, 9);
  });

  it('локальные координаты около origin малы — во float32 не дрожат', () => {
    const projector = createProjector(MOSCOW);
    const local = projector.toLocal({ lat: MOSCOW.lat + 0.02, lng: MOSCOW.lng + 0.02 });
    expect(Math.abs(local.x)).toBeLessThan(5000);
    expect(Math.abs(local.y)).toBeLessThan(5000);
  });

  it('матрица камеры ставит центр карты в центр экрана', () => {
    const origin = lngLatToMercator(MOSCOW);
    const m = cameraMatrixWorklet(MOSCOW.lng, MOSCOW.lat, 15, 0, 400, 800, origin.x, origin.y);

    // Локальная точка (0,0) — это и есть центр камеры.
    const x = m[0]! * 0 + m[1]! * 0 + m[2]!;
    const y = m[3]! * 0 + m[4]! * 0 + m[5]!;
    expect(x).toBeCloseTo(200, 6);
    expect(y).toBeCloseTo(400, 6);
  });

  it('точка севернее центра оказывается выше на экране', () => {
    const origin = lngLatToMercator(MOSCOW);
    const projector = createProjector(MOSCOW);
    const north = projector.toLocal({ lat: MOSCOW.lat + 0.005, lng: MOSCOW.lng });
    const m = cameraMatrixWorklet(MOSCOW.lng, MOSCOW.lat, 15, 0, 400, 800, origin.x, origin.y);

    const y = m[3]! * north.x + m[4]! * north.y + m[5]!;
    expect(y).toBeLessThan(400);
  });

  it('поворот камеры на 180° отражает смещение', () => {
    const origin = lngLatToMercator(MOSCOW);
    const projector = createProjector(MOSCOW);
    const north = projector.toLocal({ lat: MOSCOW.lat + 0.005, lng: MOSCOW.lng });

    const straight = cameraMatrixWorklet(MOSCOW.lng, MOSCOW.lat, 15, 0, 400, 800, origin.x, origin.y);
    const flipped = cameraMatrixWorklet(MOSCOW.lng, MOSCOW.lat, 15, 180, 400, 800, origin.x, origin.y);

    const yStraight = straight[3]! * north.x + straight[4]! * north.y + straight[5]!;
    const yFlipped = flipped[3]! * north.x + flipped[4]! * north.y + flipped[5]!;
    expect(yStraight - 400).toBeCloseTo(-(yFlipped - 400), 4);
  });

  it('масштаб удваивается на каждый зум', () => {
    expect(pixelsPerMercatorMeter(16) / pixelsPerMercatorMeter(15)).toBeCloseTo(2, 9);
  });

  it('искажение Меркатора растёт с широтой', () => {
    const atEquator = groundMetersToMercatorMeters(50, 0);
    const atMoscow = groundMetersToMercatorMeters(50, 55.76);
    expect(atEquator).toBeCloseTo(50, 6);
    expect(atMoscow).toBeGreaterThan(88);
    expect(atMoscow).toBeLessThan(90);
  });

  it('haversine совпадает с известным расстоянием', () => {
    // 0.01° широты ≈ 1111 м на любой долготе.
    const d = haversineMeters(MOSCOW, { lat: MOSCOW.lat + 0.01, lng: MOSCOW.lng });
    expect(d).toBeGreaterThan(1105);
    expect(d).toBeLessThan(1115);
  });
});

describe('coverage', () => {
  it('круг раскрытия покрывает площадь, близкую к πr²', () => {
    const cells = cellsAround(MOSCOW, 50);
    // Ячейка res 11 ~2150 м², круг r=50 м ~7854 м².
    expect(cells.length).toBeGreaterThanOrEqual(3);
    expect(cells.length).toBeLessThanOrEqual(12);
  });

  it('отрезок раскрывается без дырок', () => {
    const a = MOSCOW;
    const b = { lat: MOSCOW.lat, lng: MOSCOW.lng + 0.003 }; // ~190 м на восток
    const alongSegment = cellsAlongSegment(a, b, 50);
    const endpointsOnly = new Set([...cellsAround(a, 50), ...cellsAround(b, 50)]);

    // Досэмплирование должно давать заметно больше ячеек, чем два конца.
    expect(alongSegment.length).toBeGreaterThan(endpointsOnly.size);
  });

  it('процент форматируется по-человечески', () => {
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(0.0004)).toBe('<1%');
    expect(formatPercent(0.259)).toBe('25%');
    expect(formatPercent(1)).toBe('100%');
  });
});

describe('filter', () => {
  const base = { lat: MOSCOW.lat, lng: MOSCOW.lng, accuracy: 5, timestamp: 1_000_000 };

  it('первая точка начинает сегмент', () => {
    const { verdict } = filterStep(initialFilterState, base);
    expect(verdict.kind).toBe('segment-start');
  });

  it('плохая точность отбрасывается', () => {
    const { verdict } = filterStep(initialFilterState, { ...base, accuracy: 120 });
    expect(verdict).toMatchObject({ kind: 'rejected', reason: 'accuracy' });
  });

  it('дрожание не двигает last — иначе накопится фантомный путь', () => {
    let state = filterStep(initialFilterState, base).state;
    for (let i = 0; i < 20; i++) {
      const result = filterStep(state, {
        ...base,
        lat: base.lat + 0.00001 * (i % 2),
        timestamp: base.timestamp + i * 1000,
      });
      state = result.state;
      expect(result.verdict.kind).toBe('rejected');
    }
    expect(state.last?.timestamp).toBe(base.timestamp);
  });

  it('телепорт рвёт трек, а не рисует линию через город', () => {
    const state = filterStep(initialFilterState, base).state;
    const jump = filterStep(state, { ...base, lat: base.lat + 0.1, timestamp: base.timestamp + 5000 });
    expect(jump.verdict).toMatchObject({ kind: 'rejected', reason: 'speed' });
    expect(jump.state.last).toBeNull();
  });

  it('длинный разрыв во времени начинает новый сегмент', () => {
    const state = filterStep(initialFilterState, base).state;
    const next = filterStep(state, {
      ...base,
      lat: base.lat + 0.001,
      timestamp: base.timestamp + 10 * 60_000,
    });
    expect(next.verdict.kind).toBe('segment-start');
  });

  it('фикстура проходит фильтр с правдоподобным результатом', () => {
    const points = parseGpx(WALK_CHISTYE_PRUDY_GPX);
    const run = filterTrack(points, DEFAULT_FILTER);

    expect(points.length).toBeGreaterThan(150);
    expect(run.segments.length).toBeGreaterThanOrEqual(1);
    // Трек ~2.6 км; фильтр срезает часть шума, но не половину пути.
    expect(run.distanceM).toBeGreaterThan(1800);
    expect(run.distanceM).toBeLessThan(3200);
    // Провалы точности в фикстуре заложены — фильтр обязан их поймать.
    expect(run.rejected.accuracy).toBeGreaterThan(0);
  });
});

describe('gpx', () => {
  it('парсит координаты, время и точность', () => {
    const points = parseGpx(WALK_CHISTYE_PRUDY_GPX);
    const first = points[0]!;
    expect(first.lat).toBeCloseTo(55.76, 1);
    expect(first.lng).toBeCloseTo(37.64, 1);
    expect(first.accuracy).toBeGreaterThan(0);
    expect(Number.isFinite(first.timestamp)).toBe(true);
  });

  it('round-trip через toGpx сохраняет координаты', () => {
    const original = parseGpx(WALK_CHISTYE_PRUDY_GPX).slice(0, 10);
    const reparsed = parseGpx(toGpx(original));

    expect(reparsed).toHaveLength(original.length);
    reparsed.forEach((point, index) => {
      expect(point.lat).toBeCloseTo(original[index]!.lat, 6);
      expect(point.lng).toBeCloseTo(original[index]!.lng, 6);
      expect(point.timestamp).toBe(original[index]!.timestamp);
    });
  });

  it('точки без <time> получают синтетические метки по порядку', () => {
    const xml = `<gpx><trk><trkseg>
      <trkpt lat="55.1" lon="37.1"/>
      <trkpt lat="55.2" lon="37.2"/>
    </trkseg></trk></gpx>`;
    const points = parseGpx(xml, { startedAt: 0, syntheticStepMs: 1000 });
    expect(points.map((p) => p.timestamp)).toEqual([0, 1000]);
  });
});

describe('sun', () => {
  it('закат в Москве в середине сентября — около 19:00 MSK', () => {
    const { sunset } = sunTimes(Date.UTC(2026, 8, 15, 12, 0, 0), MOSCOW.lat, MOSCOW.lng);
    expect(sunset).not.toBeNull();
    // MSK = UTC+3, ожидаем 18:30-19:30 местного, то есть 15:30-16:30 UTC.
    const hourUtc = new Date(sunset!).getUTCHours();
    expect(hourUtc).toBeGreaterThanOrEqual(15);
    expect(hourUtc).toBeLessThanOrEqual(16);
  });

  it('прогулка в 21:40 MSK в сентябре считается ночной', () => {
    expect(isAfterSunset(Date.UTC(2026, 8, 15, 18, 40, 0), MOSCOW.lat, MOSCOW.lng)).toBe(true);
  });

  it('прогулка в полдень — не ночная', () => {
    expect(isAfterSunset(Date.UTC(2026, 8, 15, 9, 0, 0), MOSCOW.lat, MOSCOW.lng)).toBe(false);
  });

  it('полярный день в Мурманске в июне — солнце не заходит', () => {
    const { sunset } = sunTimes(Date.UTC(2026, 5, 21, 12, 0, 0), 68.97, 33.08);
    expect(sunset).toBeNull();
    expect(isAfterSunset(Date.UTC(2026, 5, 21, 23, 0, 0), 68.97, 33.08)).toBe(false);
  });

  it('полярная ночь в Мурманске в декабре — темно и в полдень', () => {
    expect(isAfterSunset(Date.UTC(2026, 11, 21, 9, 0, 0), 68.97, 33.08)).toBe(true);
  });
});

describe('projectToScreenWorklet', () => {
  const width = 390;
  const height = 700;
  const origin = lngLatToMercator(MOSCOW);
  const matrix = cameraMatrixWorklet(
    MOSCOW.lng,
    MOSCOW.lat,
    15,
    0,
    width,
    height,
    origin.x,
    origin.y,
  );

  it('ставит центр камеры в центр экрана', () => {
    const p = projectToScreenWorklet(MOSCOW.lng, MOSCOW.lat, matrix, origin.x, origin.y);
    expect(p.x).toBeCloseTo(width / 2, 6);
    expect(p.y).toBeCloseTo(height / 2, 6);
  });

  it('точка восточнее уходит вправо, севернее — вверх', () => {
    const east = projectToScreenWorklet(MOSCOW.lng + 0.01, MOSCOW.lat, matrix, origin.x, origin.y);
    const north = projectToScreenWorklet(MOSCOW.lng, MOSCOW.lat + 0.01, matrix, origin.x, origin.y);

    expect(east.x).toBeGreaterThan(width / 2);
    expect(east.y).toBeCloseTo(height / 2, 6);
    expect(north.y).toBeLessThan(height / 2);
    expect(north.x).toBeCloseTo(width / 2, 6);
  });

  it('согласован с матрицей тумана при повороте камеры', () => {
    const rotated = cameraMatrixWorklet(
      MOSCOW.lng,
      MOSCOW.lat,
      15,
      90,
      width,
      height,
      origin.x,
      origin.y,
    );
    const p = projectToScreenWorklet(MOSCOW.lng + 0.01, MOSCOW.lat, rotated, origin.x, origin.y);

    // При повороте на 90° восток перестаёт быть «вправо»: он уезжает вверх,
    // ровно так же, как повернётся коридор тумана с той же матрицей.
    expect(p.x).toBeCloseTo(width / 2, 6);
    expect(p.y).toBeLessThan(height / 2);
  });
});
