/**
 * Сборка геометрии тумана и подсчёт покрытия.
 *
 * Перестройка намеренно throttled: `geometryVersion` растёт на каждую
 * принятую точку, а пересобирать SkPath по всей истории 2 раза в секунду
 * незачем. Во время прогулки хватает раза в секунду — новая точка всё
 * равно добавляет метры, а не километры.
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
  const [geometry, setGeometry] = useState<FogGeometry | null>(null);
  const [stats, setStats] = useState({ points: 0, segments: 0, buildMs: 0 });
  const lastBuild = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!origin) return;

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

      setGeometry(next);
      setStats({
        points: next.pointCount,
        segments: next.segmentCount,
        buildMs: Date.now() - started,
      });
      lastBuild.current = Date.now();
    };

    const sinceLast = Date.now() - lastBuild.current;
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
    const dLat = radiusKm / 111.32;
    const dLng = dLat / Math.cos((origin.lat * Math.PI) / 180);
    const ring: number[][] = [
      [origin.lng - dLng, origin.lat - dLat],
      [origin.lng + dLng, origin.lat - dLat],
      [origin.lng + dLng, origin.lat + dLat],
      [origin.lng - dLng, origin.lat + dLat],
      [origin.lng - dLng, origin.lat - dLat],
    ];
    return regionCells(ring, CELL_RES).length;
  }, [origin?.lat, origin?.lng, radiusKm]);

  return useMemo(
    () => coverageStats(Math.min(exploredCells, regionTotal), regionTotal),
    [exploredCells, regionTotal],
  );
}
