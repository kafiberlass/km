/**
 * Места, где друзья бывали, поверх карты.
 *
 * Сами люди — в PeopleLayer: их метки приходится разводить, когда они
 * попадают в одну точку, а сделать это может только слой, который видит
 * всех сразу. Места разводить незачем, они и так стоят где стоят.
 *
 * Почему React, а не аннотации MapLibre: туман рисуется слоем Skia поверх
 * карты, и всё, что живёт внутри карты, оказывается под ним.
 *
 * Чтобы метки не отставали от карты, позиция считается тем же воркетом,
 * что и матрица тумана: камера лежит в SharedValue, пересчёт идёт на
 * UI-потоке, React при панорамировании не просыпается.
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

import {
  cameraMatrixWorklet,
  lngLatToMercator,
  projectToScreenWorklet,
  type LngLat,
} from '@/core/geo/mercator';
import { palette, radii, spacing } from '@/core/theme/tokens';
import type { SharedCamera } from '@/features/fog/FogLayer';

import type { Friend, FriendVisit } from './types';

const VISIT = 30;

const VISIT_ICONS: Record<FriendVisit['type'], keyof typeof Feather.glyphMap> = {
  cafe: 'coffee',
  park: 'sun',
  viewpoint: 'eye',
};

interface Props {
  friends: readonly Friend[];
  origin: LngLat;
  camera: SharedValue<SharedCamera>;
  width: number;
  height: number;
}

export function FriendsLayer({ friends, origin, camera, width, height }: Props) {
  const originMerc = useMemo(() => lngLatToMercator(origin), [origin.lat, origin.lng]);

  if (width === 0 || height === 0) return null;

  return (
    <View style={styles.root} pointerEvents="none">
      {friends.map((friend) => (
        <React.Fragment key={friend.id}>
          {friend.visits.map((visit) => (
            <Marker
              key={visit.id}
              point={visit}
              size={VISIT}
              camera={camera}
              originMerc={originMerc}
              width={width}
              height={height}
            >
              <View style={[styles.visit, { borderColor: friend.color }]}>
                <Feather name={VISIT_ICONS[visit.type]} size={15} color={palette.textDark} />
              </View>
              <Text style={styles.visitLabel} numberOfLines={1}>
                {visit.title}
              </Text>
            </Marker>
          ))}

        </React.Fragment>
      ))}
    </View>
  );
}

/**
 * Одна метка: считает свои экранные координаты из камеры и прячется,
 * когда уезжает за край. Прятать обязательно — иначе метки копятся
 * за границей экрана и каждая продолжает пересчитываться каждый кадр.
 */
function Marker({
  point,
  size,
  camera,
  originMerc,
  width,
  height,
  children,
}: {
  point: LngLat;
  size: number;
  camera: SharedValue<SharedCamera>;
  originMerc: { x: number; y: number };
  width: number;
  height: number;
  children: React.ReactNode;
}) {
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

    const margin = size * 2;
    const visible =
      screen.x > -margin &&
      screen.x < width + margin &&
      screen.y > -margin &&
      screen.y < height + margin;

    return {
      opacity: visible ? 1 : 0,
      transform: [{ translateX: screen.x - size / 2 }, { translateY: screen.y - size / 2 }],
    };
  });

  return <Animated.View style={[styles.marker, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  // Ширина фиксированная, чтобы подпись под меткой центрировалась
  // относительно самой метки, а не растягивала её.
  marker: { position: 'absolute', top: 0, left: 0, width: 96, marginLeft: -28, alignItems: 'center' },

  visit: {
    width: VISIT,
    height: VISIT,
    borderRadius: radii.sm,
    borderWidth: 3,
    backgroundColor: palette.parchmentBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visitLabel: {
    marginTop: 2,
    paddingHorizontal: spacing.xs,
    color: palette.parchmentBright,
    fontSize: 10,
    letterSpacing: 0.3,
    textShadowColor: palette.ink,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});
