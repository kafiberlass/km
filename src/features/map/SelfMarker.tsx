/**
 * Метка «я» поверх карты.
 *
 * Рисуется тем же способом, что и друзья: положение считается воркетом
 * из матрицы камеры, поэтому точка не отстаёт при панорамировании
 * и не будит React. Поверх тумана — иначе собственная метка пропадала бы
 * там, где ещё не гулял, то есть в самом начале и повсюду.
 */

import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import {
  cameraMatrixWorklet,
  lngLatToMercator,
  projectToScreenWorklet,
  type LngLat,
} from '@/core/geo/mercator';
import { palette } from '@/core/theme/tokens';
import type { SharedCamera } from '@/features/fog/FogLayer';

const DOT = 18;
const HALO = 34;

interface Props {
  point: LngLat;
  origin: LngLat;
  camera: SharedValue<SharedCamera>;
  width: number;
  height: number;
  /** Во время прогулки метка ярче: видно, что запись идёт. */
  active?: boolean;
}

export function SelfMarker({ point, origin, camera, width, height, active = false }: Props) {
  const originMerc = useMemo(() => lngLatToMercator(origin), [origin.lat, origin.lng]);

  const style = useAnimatedStyle(() => {
    const matrix = cameraMatrixWorklet(
      camera.value.lng,
      camera.value.lat,
      camera.value.zoom,
      camera.value.bearing,
      width,
      height,
      originMerc.x,
      originMerc.y,
    );
    const screen = projectToScreenWorklet(point.lng, point.lat, matrix, originMerc.x, originMerc.y);

    const visible =
      screen.x > -HALO && screen.x < width + HALO && screen.y > -HALO && screen.y < height + HALO;

    return {
      opacity: visible ? 1 : 0,
      transform: [{ translateX: screen.x - HALO / 2 }, { translateY: screen.y - HALO / 2 }],
    };
  });

  if (width === 0 || height === 0) return null;

  return (
    <View style={styles.root} pointerEvents="none">
      <Animated.View style={[styles.marker, style]}>
        <View style={[styles.halo, active && styles.haloActive]} />
        <View style={styles.dot} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  marker: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: HALO,
    height: HALO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: HALO,
    height: HALO,
    borderRadius: HALO / 2,
    backgroundColor: palette.parchmentBright,
    opacity: 0.35,
  },
  haloActive: { backgroundColor: palette.ember, opacity: 0.5 },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 3,
    borderColor: palette.ink,
    backgroundColor: palette.ember,
  },
});
