/**
 * Интересные места на карте.
 *
 * Поверх тумана — и это осознанно. Туман прячет то, где человек не был,
 * но место, которого не видно, невозможно выбрать целью: непонятно,
 * куда идти. Поэтому метка видна всегда, а туманом остаётся скрыто то,
 * что вокруг неё.
 *
 * Название неоткрытого места не показывается: смысл механики в том, чтобы
 * дойти и узнать. Вид (парк, кафе, смотровая) видно сразу — по нему
 * и выбирают, куда идти.
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

import type { PlaceRow } from '@/core/db/repo';
import {
  cameraMatrixWorklet,
  lngLatToMercator,
  projectToScreenWorklet,
  type LngLat,
} from '@/core/geo/mercator';
import { fonts, palette, radii, spacing } from '@/core/theme/tokens';
import type { SharedCamera } from '@/features/fog/FogLayer';

import { placeKind } from './kinds';

const MARKER = 30;

interface Props {
  places: readonly PlaceRow[];
  origin: LngLat;
  camera: SharedValue<SharedCamera>;
  width: number;
  height: number;
}

export function PlacesLayer({ places, origin, camera, width, height }: Props) {
  const originMerc = useMemo(() => lngLatToMercator(origin), [origin.lat, origin.lng]);

  if (width === 0 || height === 0 || places.length === 0) return null;

  return (
    <View style={styles.root} pointerEvents="none">
      {places.map((place) => (
        <PlaceMarker
          key={place.id}
          place={place}
          camera={camera}
          originMerc={originMerc}
          width={width}
          height={height}
        />
      ))}
    </View>
  );
}

function PlaceMarker({
  place,
  camera,
  originMerc,
  width,
  height,
}: {
  place: PlaceRow;
  camera: SharedValue<SharedCamera>;
  originMerc: { x: number; y: number };
  width: number;
  height: number;
}) {
  const kind = placeKind(place.type);
  const found = place.discoveredAt != null;

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
    const screen = projectToScreenWorklet(place.lng, place.lat, matrix, originMerc.x, originMerc.y);

    // Уехавшие за край прячем: иначе метки копятся за границей экрана
    // и каждая пересчитывается каждый кадр.
    const margin = MARKER * 3;
    const visible =
      screen.x > -margin &&
      screen.x < width + margin &&
      screen.y > -margin &&
      screen.y < height + margin;

    return {
      opacity: visible ? 1 : 0,
      transform: [{ translateX: screen.x - MARKER / 2 }, { translateY: screen.y - MARKER / 2 }],
    };
  });

  return (
    <Animated.View style={[styles.marker, style]}>
      <View
        style={[
          styles.pin,
          { borderColor: kind.color },
          found ? { backgroundColor: kind.color } : styles.pinHidden,
        ]}
      >
        <Feather
          name={kind.icon}
          size={15}
          color={found ? palette.parchmentBright : kind.color}
        />
      </View>

      {/* Название — награда за то, что дошёл. До этого видно только вид. */}
      <Text style={found ? styles.title : styles.titleHidden} numberOfLines={1}>
        {found ? place.title : `+${place.xpReward} XP`}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  // Ширина фиксированная, чтобы подпись центрировалась относительно метки,
  // а не растягивала её.
  marker: { position: 'absolute', top: 0, left: 0, width: 110, marginLeft: -40, alignItems: 'center' },

  pin: {
    width: MARKER,
    height: MARKER,
    borderRadius: radii.sm,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Неоткрытое место — светлая плитка с цветной рамкой: видно, что там
  // что-то есть, и какого рода, но не что именно.
  pinHidden: { backgroundColor: palette.parchmentBright, borderStyle: 'dashed' },

  title: {
    marginTop: 2,
    paddingHorizontal: spacing.xs,
    color: palette.parchmentBright,
    fontFamily: fonts.display,
    fontWeight: '700',
    fontSize: 11,
    textShadowColor: palette.ink,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  titleHidden: {
    marginTop: 2,
    color: palette.gold,
    fontFamily: fonts.mono,
    fontSize: 13,
    textShadowColor: palette.ink,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});
