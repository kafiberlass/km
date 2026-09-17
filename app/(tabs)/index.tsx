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
import { FogLayer, type SharedCamera } from '@/features/fog/FogLayer';
import { useCoverage, useFogGeometry } from '@/features/fog/useFog';
import { useFriends, usePublishPosition } from '@/features/friends';
import { FriendsLayer } from '@/features/friends/FriendsLayer';
import type { CameraRef } from '@maplibre/maplibre-react-native';

import { getFlag, setFlag } from '@/core/db/kv';
import { MapCanvas } from '@/features/map/MapCanvas';
import { SelfMarker } from '@/features/map/SelfMarker';
import { useAutoWalk } from '@/features/tracking/useAutoWalk';
import { useLastKnownPosition } from '@/features/tracking/useLastKnown';
import { DEMO_CENTER } from '@/features/places/seed';
import { ActionButton, Chip, Toast, XpBar } from '@/ui/widgets';
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
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [showFriends, setShowFriends] = useState(true);
  const cameraRef = useRef<CameraRef>(null);

  // Настройка живёт в базе: человек включил автоопределение один раз,
  // а не заново после каждого перезапуска.
  const [autoWalk, setAutoWalk] = useState(() => getFlag('auto-walk', false));

  const status = useWalkStore((s) => s.status);
  const level = useWalkStore((s) => s.level);
  const xp = useWalkStore((s) => s.xp);
  const streakDays = useWalkStore((s) => s.streakDays);
  const exploredCells = useWalkStore((s) => s.exploredCells);
  const districts = useWalkStore((s) => s.districts);
  const geometryVersion = useWalkStore((s) => s.geometryVersion);
  const liveSegment = useWalkStore((s) => s.liveSegment);
  const distanceM = useWalkStore((s) => s.distanceM);
  const toast = useWalkStore((s) => s.toast);
  const dismissToast = useWalkStore((s) => s.dismissToast);
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

  const { geometry, stats } = useFogGeometry(origin, geometryVersion, liveSegment);
  const coverage = useCoverage(origin, exploredCells);
  const friends = useFriends(origin, showFriends);

  const tracking = status === 'tracking' || status === 'starting';

  // Делимся позицией только на прогулке: круглосуточная трансляция —
  // другая фича и другой разговор про приватность.
  const livePoint = liveSegment.length > 0 ? liveSegment[liveSegment.length - 1]! : null;
  usePublishPosition(origin, livePoint, tracking);

  // Где я сам. На прогулке — свежая точка трека, до неё — последняя
  // известная системе, а если и её нет, то точка отсчёта: лучше показать
  // метку в примерном месте, чем не показать вовсе.
  const lastKnown = useLastKnownPosition();
  const myPoint = livePoint ?? lastKnown ?? origin;

  // Прогресс квартала, в котором человек стоит прямо сейчас. Это и есть
  // ответ на «сколько осталось» — в отличие от процента по всему району.
  const hereId = districtAt(myPoint);
  const here = progressOf(districts.get(hereId) ?? 0, hereId);

  const centerOnMe = useCallback(() => {
    // Если человек уже приблизился сильнее — не отдаляем: кнопка должна
    // возвращать к себе, а не сбрасывать масштаб, который он выбрал сам.
    const zoom = Math.max(camera.value.zoom, CLOSE_ZOOM);
    cameraRef.current?.flyTo({ center: [myPoint.lng, myPoint.lat], zoom, duration: 700 });
  }, [camera, myPoint.lat, myPoint.lng]);

  const toggleAutoWalk = useCallback(() => {
    setAutoWalk((value) => {
      const next = !value;
      setFlag('auto-walk', next);
      return next;
    });
  }, []);

  const toggle = useCallback(() => {
    if (tracking) void stop();
    else void start();
  }, [start, stop, tracking]);

  // Автоопределение зовёт те же start и stop, что и кнопка: ручной
  // и автоматический путь не должны расходиться в поведении.
  useAutoWalk(
    autoWalk,
    tracking,
    useCallback(() => {
      void start();
    }, [start]),
    useCallback(() => {
      void stop();
    }, [stop]),
  );

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
        <MapCanvas
          ref={cameraRef}
          camera={camera}
          initialCenter={[origin.lng, origin.lat]}
          onLayoutSize={setSize}
        />

        {size.width > 0 && (
          <FogLayer
            geometry={geometry}
            origin={origin}
            camera={camera}
            width={size.width}
            height={size.height}
          />
        )}

        {size.width > 0 && (
          <SelfMarker
            point={myPoint}
            origin={origin}
            camera={camera}
            width={size.width}
            height={size.height}
            active={tracking}
          />
        )}

        {/* Друзья рисуются НАД туманом: иначе метка исчезает ровно там,
            где ты ещё не гулял, — то есть почти везде. */}
        {size.width > 0 && showFriends && (
          <FriendsLayer
            friends={friends}
            origin={origin}
            camera={camera}
            width={size.width}
            height={size.height}
          />
        )}

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
            <Pressable onPress={toggleAutoWalk}>
              <Chip
                label={autoWalk ? 'АВТО ВКЛ' : 'АВТО ВЫКЛ'}
                icon={
                  <Feather
                    name="activity"
                    size={16}
                    color={autoWalk ? palette.textDark : palette.textMuted}
                  />
                }
                style={autoWalk ? undefined : styles.chipOff}
              />
            </Pressable>

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

        <Pressable
          onPress={centerOnMe}
          style={({ pressed }) => [styles.locate, pressed && styles.locatePressed]}
          accessibilityRole="button"
          accessibilityLabel="Вернуться к своей точке"
        >
          <Feather name="navigation" size={20} color={palette.textDark} />
        </Pressable>

        <View style={styles.overlayBottom} pointerEvents="box-none">
          {toast && (
            <Toast title={toast.title} subtitle={toast.subtitle} onDismiss={dismissToast} />
          )}

          {tracking && (
            <View style={styles.liveRow}>
              <Text style={styles.liveText}>
                {(distanceM / 1000).toFixed(2)} км · {stats.points} точек · сборка{' '}
                {stats.buildMs} мс
              </Text>
            </View>
          )}

          <ActionButton
            label={tracking ? 'ЗАВЕРШИТЬ ПРОГУЛКУ' : 'НАЧАТЬ ПРОГУЛКУ'}
            onPress={toggle}
            tone={tracking ? 'ghost' : 'primary'}
          />
        </View>
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
  // а кнопку прогулки не перекрывает.
  locate: {
    position: 'absolute',
    right: spacing.md,
    bottom: 96,
    width: 48,
    height: 48,
    borderRadius: 24,
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
  liveRow: { alignItems: 'center' },
  liveText: { color: palette.parchment, fontSize: 12, fontVariant: ['tabular-nums'] },
});
