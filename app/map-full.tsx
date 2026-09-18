/**
 * Карта во весь экран.
 *
 * На главном экране карта делит место с закатом, полосой опыта и кнопкой
 * прогулки — гулять по ней глазами неудобно. Здесь нет ничего, кроме карты
 * и четырёх органов управления: закрыть, вернуться к себе, показать друзей,
 * начать или закончить прогулку.
 *
 * Состояние общее с главным экраном (то же хранилище, та же база), так что
 * прогулка, начатая здесь, продолжается там же и наоборот.
 */

import React, { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedValue } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { CameraRef } from '@maplibre/maplibre-react-native';

import { getProfile } from '@/core/db/repo';
import { formatPercent } from '@/core/geo/coverage';
import { districtAt, progressOf } from '@/core/geo/districts';
import { palette, spacing } from '@/core/theme/tokens';
import type { SharedCamera } from '@/features/fog/FogLayer';
import { useCoverage, useFogGeometry } from '@/features/fog/useFog';
import { useFriends } from '@/features/friends';
import { MapStack } from '@/features/map/MapStack';
import { DEMO_CENTER } from '@/features/places/seed';
import { useMyPosition } from '@/features/tracking/useMyPosition';
import { ActionButton, Chip } from '@/ui/widgets';
import { useWalkStore } from '@/store/useWalkStore';

/** Тот же масштаб, что и у кнопки «к себе» на главном экране. */
const CLOSE_ZOOM = 16;

export default function FullMapScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const cameraRef = useRef<CameraRef>(null);
  const [showFriends, setShowFriends] = useState(true);

  const status = useWalkStore((s) => s.status);
  const exploredCells = useWalkStore((s) => s.exploredCells);
  const districts = useWalkStore((s) => s.districts);
  const geometryVersion = useWalkStore((s) => s.geometryVersion);
  const liveSegment = useWalkStore((s) => s.liveSegment);
  const distanceM = useWalkStore((s) => s.distanceM);
  const start = useWalkStore((s) => s.start);
  const stop = useWalkStore((s) => s.stop);

  const profile = getProfile();
  const origin =
    profile.originLat != null && profile.originLng != null
      ? { lat: profile.originLat, lng: profile.originLng }
      : { lat: DEMO_CENTER[1], lng: DEMO_CENTER[0] };

  const camera = useSharedValue<SharedCamera>({
    lng: origin.lng,
    lat: origin.lat,
    zoom: 15,
    bearing: 0,
  });

  const { geometry } = useFogGeometry(origin, geometryVersion, liveSegment);
  const coverage = useCoverage(origin, exploredCells);
  const friends = useFriends(origin, showFriends);

  const tracking = status === 'tracking' || status === 'starting';

  // Позицию в облако отсюда НЕ публикуем: этим занят главный экран,
  // который остаётся смонтированным под этим окном. Две публикации
  // одной и той же точки — лишний трафик и гонка за один и тот же слот.
  const livePoint = liveSegment.length > 0 ? liveSegment[liveSegment.length - 1]! : null;
  const { point: knownPoint, locate } = useMyPosition();
  const myPoint = livePoint ?? knownPoint ?? origin;

  const hereId = districtAt(myPoint);
  const here = progressOf(districts.get(hereId) ?? 0, hereId);

  const centerOnMe = useCallback(async () => {
    const fresh = await locate();
    const target = fresh ?? myPoint;
    const zoom = Math.max(camera.value.zoom, CLOSE_ZOOM);
    cameraRef.current?.flyTo({ center: [target.lng, target.lat], zoom, duration: 700 });
  }, [camera, locate, myPoint]);

  const toggle = useCallback(() => {
    if (tracking) void stop();
    else void start();
  }, [start, stop, tracking]);

  return (
    <View style={styles.root}>
      <MapStack
        ref={cameraRef}
        camera={camera}
        origin={origin}
        geometry={geometry}
        myPoint={myPoint}
        tracking={tracking}
        friends={showFriends ? friends : []}
      >
        <View style={[styles.top, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.round, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Закрыть карту"
          >
            <Feather name="x" size={22} color={palette.textDark} />
          </Pressable>

          <View style={styles.chips} pointerEvents="box-none">
            <Chip
              label={`ОТКРЫТО ${formatPercent(coverage.ratio)}`}
              icon={<Feather name="map" size={16} color={palette.textDark} />}
            />
            <Chip
              label={here.done ? 'КВАРТАЛ ЗАКРЫТ' : `КВАРТАЛ ${Math.round(here.ratio * 100)}%`}
              icon={
                <Feather
                  name={here.done ? 'check-circle' : 'grid'}
                  size={16}
                  color={here.done ? palette.teal : palette.textDark}
                />
              }
            />
          </View>
        </View>

        <View style={[styles.side, { bottom: insets.bottom + 96 }]} pointerEvents="box-none">
          <Pressable
            onPress={() => setShowFriends((value) => !value)}
            style={({ pressed }) => [
              styles.round,
              !showFriends && styles.roundOff,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={showFriends ? 'Скрыть друзей' : 'Показать друзей'}
          >
            <Feather
              name="users"
              size={20}
              color={showFriends ? palette.textDark : palette.textMuted}
            />
          </Pressable>

          <Pressable
            onPress={() => void centerOnMe()}
            style={({ pressed }) => [styles.round, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Вернуться к своей точке"
          >
            <Feather name="navigation" size={20} color={palette.textDark} />
          </Pressable>
        </View>

        <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.md }]} pointerEvents="box-none">
          {tracking && (
            <Text style={styles.liveText}>{(distanceM / 1000).toFixed(2)} км за эту прогулку</Text>
          )}

          <ActionButton
            label={tracking ? 'ЗАВЕРШИТЬ ПРОГУЛКУ' : 'НАЧАТЬ ПРОГУЛКУ'}
            onPress={toggle}
            tone={tracking ? 'ghost' : 'primary'}
          />
        </View>
      </MapStack>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.fog },
  top: {
    position: 'absolute',
    top: 0,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  chips: { alignItems: 'flex-end', gap: spacing.sm },
  side: {
    position: 'absolute',
    right: spacing.md,
    gap: spacing.sm,
  },
  round: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: palette.ink,
    backgroundColor: palette.parchmentBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundOff: { backgroundColor: palette.sand },
  pressed: { transform: [{ translateY: 2 }] },
  bottom: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: 0,
    gap: spacing.sm,
  },
  liveText: {
    color: palette.parchment,
    fontSize: 12,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
});
