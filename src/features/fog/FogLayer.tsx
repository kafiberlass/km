/**
 * Skia-слой тумана поверх карты.
 *
 * Как это работает:
 *  1. Геометрия строится ОДИН раз в локальных метрах Меркатора.
 *  2. Камера карты живёт в SharedValue, матрица считается в воркете
 *     на UI-потоке — React не ре-рендерится при панорамировании.
 *  3. Туман — сплошная заливка под маской яркости: белое в маске держит
 *     туман, чёрное протирает дырку. Дырка — обводка пути, размытая
 *     фильтром, отсюда мягкий край, как в макете.
 *
 * Маска, а не blendMode dstOut с offscreen-слоем: dstOut требует, чтобы
 * группа поднимала свой слой, и на устройстве этот слой не композился —
 * канвас оставался пустым, туман не появлялся вовсе.
 *
 * Питч не поддерживается: перспектива сломала бы постоянную толщину тропы.
 * Карта в приложении плоская, так что ограничение бесплатное.
 */

import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import {
  Blur,
  Canvas,
  Group,
  Mask,
  Path,
  Rect,
} from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { cameraMatrixWorklet, lngLatToMercator, type LngLat } from '@/core/geo/mercator';
import { palette, theme } from '@/core/theme/tokens';
import type { FogGeometry } from './geometry';

/** Камера в SharedValue — обновляется из обработчика MapLibre без setState. */
export interface SharedCamera {
  lng: number;
  lat: number;
  zoom: number;
  bearing: number;
}

interface Props {
  geometry: FogGeometry | null;
  origin: LngLat;
  camera: SharedValue<SharedCamera>;
  width: number;
  height: number;
  /** Отключает туман целиком — удобно для сравнения FPS в дев-панели. */
  enabled?: boolean;
  /** Показать оранжевую тропу поверх раскрытой зоны. */
  showTrail?: boolean;
}

export function FogLayer({
  geometry,
  origin,
  camera,
  width,
  height,
  enabled = true,
  showTrail = true,
}: Props) {
  const originMerc = useMemo(() => lngLatToMercator(origin), [origin.lat, origin.lng]);

  const matrix = useDerivedValue(() =>
    cameraMatrixWorklet(
      camera.value.lng,
      camera.value.lat,
      camera.value.zoom,
      camera.value.bearing,
      width,
      height,
      originMerc.x,
      originMerc.y,
    ),
  );

  if (!enabled || !geometry) return null;

  return (
    <Canvas style={styles.canvas}>
      <Mask
        mode="luminance"
        mask={
          <Group>
            {/* Белое — туман на месте. */}
            <Rect x={0} y={0} width={width} height={height} color="white" />

            {/* Чёрное — протёртый коридор. Размытие в экранных пикселях,
                поэтому край одинаково мягкий на любом зуме. */}
            <Group matrix={matrix}>
              <Blur blur={theme.fog.edgeBlurPx} />
              <Path
                path={geometry.reveal}
                style="stroke"
                strokeWidth={geometry.revealStrokeMerc}
                strokeCap="round"
                strokeJoin="round"
                color="black"
              />
            </Group>
          </Group>
        }
      >
        <Rect x={0} y={0} width={width} height={height} color={palette.fogVeil} />
      </Mask>

      {showTrail && (
        <Group matrix={matrix}>
          <Path
            path={geometry.trail}
            style="stroke"
            /* Ширина в метрах Меркатора: тропа всегда занимает ту же долю коридора. */
            strokeWidth={geometry.revealStrokeMerc * 0.45}
            strokeCap="round"
            strokeJoin="round"
            color={palette.ember}
            opacity={0.9}
          />
        </Group>
      )}
    </Canvas>
  );
}

const styles = StyleSheet.create({
  canvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // Слой чисто декоративный: жесты должны доходить до карты под ним.
    pointerEvents: 'none',
  },
});
