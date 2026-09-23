/**
 * Сборка геометрии тумана и подсчёт покрытия.
 *
 * Перестройка намеренно throttled: `geometryVersion` растёт на каждую
 * принятую точку, а пересобирать SkPath по всей истории 2 раза в секунду
 * незачем. Во время прогулки хватает раза в секунду — новая точка всё
 * равно добавляет метры, а не километры.
 *
 * Результат кешируется на уровне модуля, а не хука, и это не
 * преждевременная оптимизация. Карт в приложении две: на вкладке и во весь
 * экран. Каждая заводила свой хук, и открытие полноэкранной карты означало
 * заново прочитать из базы всю историю точек и собрать по ней SkPath —
 * синхронно, в том самом кадре, которым открывается экран. Снаружи это
 * выглядело как «карта открывается с задержкой». Геометрия у обеих карт
 * одна и та же, её достаточно построить один раз.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { allPlaces, loadTrackSegments, type TrackSegment } from '@/core/db/repo';
import {
  CELL_RES,
  REVEAL_RADIUS_M,
  coverageStats,
  regionCells,
  type CoverageStats,
} from '@/core/geo/coverage';
import type { LngLat } from '@/core/geo/mercator';
import { buildFogGeometry, type FogGeometry, type RevealCircle } from './geometry';

const REBUILD_THROTTLE_MS = 1000;

interface FogStats {
  points: number;
  segments: number;
  buildMs: number;
}

interface FogCache {
  key: string;
  geometry: FogGeometry;
  stats: FogStats;
  builtAt: number;
}

/** Последняя собранная геометрия — общая для всех карт в приложении. */
let cache: FogCache | null = null;

/** Число ячеек домашнего района: тоже одно на всё приложение. */
let regionCache: { key: string; total: number } | null = null;

function cacheKey(origin: LngLat, version: number): string {
  return `${origin.lat},${origin.lng}|${version}`;
}

export interface UseFogResult {
  geometry: FogGeometry | null;
  /** Сколько точек попало в геометрию — метрика для дев-панели. */
  stats: { points: number; segments: number; buildMs: number };
}

export function useFogGeometry(
  origin: LngLat | null,
  version: number,
  liveSegment: readonly LngLat[],
): UseFogResult {
  // Готовая геометрия подхватывается сразу, ещё до первого кадра: иначе
  // вторая карта на мгновение показывает пустоту и только потом туман.
  const ready = origin && cache?.key === cacheKey(origin, version) ? cache : null;

  const [geometry, setGeometry] = useState<FogGeometry | null>(ready?.geometry ?? null);
  const [stats, setStats] = useState<FogStats>(
    ready?.stats ?? { points: 0, segments: 0, buildMs: 0 },
  );
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!origin) return;

    const key = cacheKey(origin, version);

    // Кто-то уже собрал ровно это. Не читаем базу и не строим пути заново.
    if (cache?.key === key) {
      setGeometry(cache.geometry);
      setStats(cache.stats);
      return;
    }

    const build = () => {
      const started = Date.now();
      const stored = loadTrackSegments();

      // Текущая прогулка ещё не долетела в БД целиком (точки пишутся пачками),
      // поэтому живой сегмент подмешивается отдельно — иначе тропа «отстаёт».
      const segments: TrackSegment[] =
        liveSegment.length > 1
          ? [...stored, { sessionId: 'live', segment: 0, points: [...liveSegment] }]
          : stored;

      const circles: RevealCircle[] = allPlaces()
        .filter((place) => place.discoveredAt != null)
        .map((place) => ({ lat: place.lat, lng: place.lng, radiusM: place.radiusM }));

      const next = buildFogGeometry(segments, origin, {
        revealRadiusM: REVEAL_RADIUS_M,
        circles,
      });

      const nextStats: FogStats = {
        points: next.pointCount,
        segments: next.segmentCount,
        buildMs: Date.now() - started,
      };

      cache = { key, geometry: next, stats: nextStats, builtAt: Date.now() };

      setGeometry(next);
      setStats(nextStats);
    };

    const sinceLast = Date.now() - (cache?.builtAt ?? 0);
    if (sinceLast >= REBUILD_THROTTLE_MS) {
      build();
      return;
    }

    if (pending.current) clearTimeout(pending.current);
    pending.current = setTimeout(build, REBUILD_THROTTLE_MS - sinceLast);
    return () => {
      if (pending.current) clearTimeout(pending.current);
    };
    // liveSegment намеренно не в зависимостях: он меняется вместе с version.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin?.lat, origin?.lng, version]);

  return { geometry, stats };
}

/**
 * Процент открытия «домашнего района».
 *
 * Район для скелета — квадрат вокруг origin. В проде это будут настоящие
 * границы города из OSM, а знаменатель посчитается один раз и ляжет
 * в таблицу regions.
 */
export function useCoverage(
  origin: LngLat | null,
  exploredCells: number,
  radiusKm = 3,
): CoverageStats {
  const regionTotal = useMemo(() => {
    if (!origin) return 0;

    // Знаменатель зависит только от дома и радиуса, а стоит недёшево:
    // квадрат 6×6 км на одиннадцатом разрешении — это около семнадцати
    // тысяч ячеек, и считает их WASM. Пока человек не переехал, число
    // одно и то же, поэтому считаем его один раз на запуск, а не на
    // каждое открытие карты.
    const key = `${origin.lat},${origin.lng}|${radiusKm}`;
    if (regionCache?.key === key) return regionCache.total;

    const dLat = radiusKm / 111.32;
    const dLng = dLat / Math.cos((origin.lat * Math.PI) / 180);
    const ring: number[][] = [
      [origin.lng - dLng, origin.lat - dLat],
      [origin.lng + dLng, origin.lat - dLat],
      [origin.lng + dLng, origin.lat + dLat],
      [origin.lng - dLng, origin.lat + dLat],
      [origin.lng - dLng, origin.lat - dLat],
    ];

    const total = regionCells(ring, CELL_RES).length;
    regionCache = { key, total };
    return total;
  }, [origin?.lat, origin?.lng, radiusKm]);

  return useMemo(
    () => coverageStats(Math.min(exploredCells, regionTotal), regionTotal),
    [exploredCells, regionTotal],
  );
}
