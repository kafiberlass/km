/**
 * Главный экран — карта с туманом войны.
 *
 * Здесь сходятся три слоя:
 *   MapLibre (тайлы) -> Skia (туман) -> React (HUD).
 * Карта и туман синхронизируются через SharedValue камеры, без setState.
 */

import React, { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedValue } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { Link } from 'expo-router';

import { getProfile } from '@/core/db/repo';
import { formatPercent } from '@/core/geo/coverage';
import { districtAt, progressOf } from '@/core/geo/districts';
import { levelXpRequirement } from '@/core/rules/xp';
import { palette, spacing } from '@/core/theme/tokens';
import type { SharedCamera } from '@/features/fog/FogLayer';
import { useCoverage, useFogGeometry } from '@/features/fog/useFog';
import { useFriends } from '@/features/friends';
import type { CameraRef } from '@maplibre/maplibre-react-native';

import { MapStack } from '@/features/map/MapStack';
import { WalkStatus } from '@/features/tracking/WalkStatus';
import { useMyPosition } from '@/features/tracking/useMyPosition';
import { DEMO_CENTER } from '@/features/places/seed';
import { Chip, Toast, XpBar } from '@/ui/widgets';
import { SunsetHeader } from '@/ui/SunsetHeader';
import { useWalkStore } from '@/store/useWalkStore';

/**
 * Масштаб, на который кнопка «к себе» приближает карту.
 *
 * 16 — несколько кварталов на экран: видно, куда идти дальше, и при этом
 * понятно, где именно ты стоишь. На 17 картинка упирается в свой двор,
 * а окрестности приходится искать пальцем.
 */
const CLOSE_ZOOM = 16;

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const [showFriends, setShowFriends] = useState(true);
  const cameraRef = useRef<CameraRef>(null);

  const status = useWalkStore((s) => s.status);
  const level = useWalkStore((s) => s.level);
  const xp = useWalkStore((s) => s.xp);
  const streakDays = useWalkStore((s) => s.streakDays);
  const exploredCells = useWalkStore((s) => s.exploredCells);
  const districts = useWalkStore((s) => s.districts);
  const geometryVersion = useWalkStore((s) => s.geometryVersion);
  const liveSegment = useWalkStore((s) => s.liveSegment);
  const toast = useWalkStore((s) => s.toast);
  const dismissToast = useWalkStore((s) => s.dismissToast);

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

  // Позиция уходит друзьям из самого конвейера точек (store.ingest):
  // так метка едет за человеком и при свёрнутом приложении.
  const livePoint = liveSegment.length > 0 ? liveSegment[liveSegment.length - 1]! : null;

  // Где я сам. На прогулке — свежая точка трека, до неё — последняя
  // известная системе, а если и её нет, то точка отсчёта: лучше показать
  // метку в примерном месте, чем не показать вовсе.
  const { point: knownPoint, locate } = useMyPosition();
  const myPoint = livePoint ?? knownPoint ?? origin;

  // Прогресс квартала, в котором человек стоит прямо сейчас. Это и есть
  // ответ на «сколько осталось» — в отличие от процента по всему району.
  const hereId = districtAt(myPoint);
  const here = progressOf(districts.get(hereId) ?? 0, hereId);

  const centerOnMe = useCallback(async () => {
    // Спрашиваем свежую точку: последняя известная может быть вчерашней
    // и увести карту в другой район — то есть ровно туда, откуда человек
    // и пытается вернуться этой кнопкой.
    const fresh = await locate();
    const target = fresh ?? myPoint;

    // Если человек уже приблизился сильнее — не отдаляем: кнопка должна
    // возвращать к себе, а не сбрасывать масштаб, который он выбрал сам.
    const zoom = Math.max(camera.value.zoom, CLOSE_ZOOM);
    cameraRef.current?.flyTo({ center: [target.lng, target.lat], zoom, duration: 700 });
  }, [camera, locate, myPoint]);

  return (
    <View style={styles.root}>
      <SunsetHeader
        level={level}
        title="Ночной бродяга"
        xp={xp}
        xpRequired={levelXpRequirement(level)}
        streakDays={streakDays}
        topInset={insets.top}
      />

      <View style={styles.barWrap}>
        <XpBar ratio={xp / levelXpRequirement(level)} />
      </View>

      <View style={styles.mapWrap}>
        <MapStack
          ref={cameraRef}
          camera={camera}
          origin={origin}
          geometry={geometry}
          myPoint={myPoint}
          tracking={tracking}
          friends={showFriends ? friends : []}
        >
          <View style={styles.overlayTop} pointerEvents="box-none">
            <View style={styles.topLeft} pointerEvents="box-none">
              <Chip
                label={`ОТКРЫТО ${formatPercent(coverage.ratio)}`}
                icon={<Feather name="map" size={16} color={palette.textDark} />}
              />
              <Chip
                label={
                  here.done
                    ? 'КВАРТАЛ ЗАКРЫТ'
                    : `КВАРТАЛ ${Math.round(here.ratio * 100)}%`
                }
                icon={
                  <Feather
                    name={here.done ? 'check-circle' : 'grid'}
                    size={16}
                    color={here.done ? palette.teal : palette.textDark}
                  />
                }
              />
            </View>

            <View style={styles.topRight} pointerEvents="box-none">
              <Pressable onPress={() => setShowFriends((value) => !value)}>
                <Chip
                  label={showFriends ? `ДРУЗЬЯ ${friends.length}` : 'ДРУЗЬЯ ВЫКЛ'}
                  icon={
                    <Feather
                      name="users"
                      size={16}
                      color={showFriends ? palette.textDark : palette.textMuted}
                    />
                  }
                  style={showFriends ? undefined : styles.chipOff}
                />
              </Pressable>

              <Link href="/dev" asChild>
                <Text style={styles.devLink}>DEV</Text>
              </Link>
            </View>
          </View>

          <Link href="/map-full" asChild>
            <Pressable
              hitSlop={spacing.sm}
              style={({ pressed }) => [styles.expand, pressed && styles.locatePressed]}
              accessibilityRole="button"
              accessibilityLabel="Открыть карту во весь экран"
            >
              <Feather name="maximize-2" size={24} color={palette.textDark} />
            </Pressable>
          </Link>

          <Pressable
            onPress={() => void centerOnMe()}
            hitSlop={spacing.sm}
            style={({ pressed }) => [styles.locate, pressed && styles.locatePressed]}
            accessibilityRole="button"
            accessibilityLabel="Вернуться к своей точке"
          >
            <Feather name="navigation" size={24} color={palette.textDark} />
          </Pressable>

          <View style={styles.overlayBottom} pointerEvents="box-none">
            {toast && (
              <Toast title={toast.title} subtitle={toast.subtitle} onDismiss={dismissToast} />
            )}

            <WalkStatus />
          </View>
        </MapStack>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Тело экрана в макете светлое: пергаментная панель, на которой лежат
  // полоса опыта и карточка карты. Тёмная здесь только сама карта.
  root: { flex: 1, backgroundColor: palette.dune },
  barWrap: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  mapWrap: {
    flex: 1,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: 16,
    borderWidth: 4,
    borderColor: palette.ink,
    overflow: 'hidden',
  },
  overlayTop: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  topLeft: { gap: spacing.sm, alignItems: 'flex-start' },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chipOff: { backgroundColor: palette.sand },
  devLink: {
    color: palette.parchment,
    fontWeight: '900',
    letterSpacing: 1,
    padding: spacing.sm,
  },
  // Над нижней панелью, у правого края: большой палец дотягивается,
  // а строку состояния не перекрывает.
  //
  // 56 пунктов, а не 48: по прежней кнопке приходилось целиться, особенно
  // на ходу. Плюс hitSlop — область нажатия ещё шире самой кнопки.
  locate: {
    position: 'absolute',
    right: spacing.md,
    bottom: 92,
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: palette.ink,
    backgroundColor: palette.parchmentBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Над кнопкой «к себе», в той же колонке: обе относятся к карте.
  expand: {
    position: 'absolute',
    right: spacing.md,
    bottom: 92 + 56 + spacing.md,
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: palette.ink,
    backgroundColor: palette.parchmentBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locatePressed: { transform: [{ translateY: 2 }] },
  overlayBottom: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    gap: spacing.sm,
  },
  liveRow: { alignItems: 'center', gap: 2 },
  liveText: { color: palette.parchment, fontSize: 12, fontVariant: ['tabular-nums'] },
});
