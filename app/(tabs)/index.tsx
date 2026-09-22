/**
 * Главный экран — карта с туманом войны.
 *
 * Здесь сходятся три слоя:
 *   MapLibre (тайлы) -> Skia (туман) -> React (HUD).
 * Карта и туман синхронизируются через SharedValue камеры, без setState.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedValue } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

import { allPlaces, getProfile } from '@/core/db/repo';
import { levelTitle, levelXpRequirement } from '@/core/rules/xp';
import { fonts, line, palette, pressStyle, spacing, text } from '@/core/theme/tokens';
import type { SharedCamera } from '@/features/fog/FogLayer';
import { useFogGeometry } from '@/features/fog/useFog';
import { isServerConfigured, useFriends } from '@/features/friends';
import type { CameraRef } from '@maplibre/maplibre-react-native';

import { isAwayFromHome } from '@/features/map/awayFromHome';
import { MapStack } from '@/features/map/MapStack';
import { QuestCard } from '@/features/quests/QuestCard';
import { useQuest } from '@/features/quests/useQuest';
import { WalkStatus } from '@/features/tracking/WalkStatus';
import { useMyPosition } from '@/features/tracking/useMyPosition';
import { DEMO_CENTER } from '@/features/places/seed';
import { Toast, XpBar } from '@/ui/widgets';
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
  const cameraRef = useRef<CameraRef>(null);

  const status = useWalkStore((s) => s.status);
  const level = useWalkStore((s) => s.level);
  const xp = useWalkStore((s) => s.xp);
  const streakDays = useWalkStore((s) => s.streakDays);
  const displayName = useWalkStore((s) => s.displayName);
  const avatar = useWalkStore((s) => s.avatar);
  const geometryVersion = useWalkStore((s) => s.geometryVersion);
  const placesVersion = useWalkStore((s) => s.placesVersion);
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
  const friends = useFriends(origin, true);

  // Цель дня. На карте — одной строкой, полностью она живёт на «Местах».
  const quest = useQuest(origin);

  // Читаются из базы заново, когда меняется их список: нашли новые
  // через OSM, открыли очередное на прогулке, восстановили копию.
  const places = useMemo(() => allPlaces(), [placesVersion]);

  const tracking = status === 'tracking' || status === 'starting';

  // Позиция уходит друзьям из самого конвейера точек (store.ingest):
  // так метка едет за человеком и при свёрнутом приложении.
  const livePoint = liveSegment.length > 0 ? liveSegment[liveSegment.length - 1]! : null;

  // Где я сам. На прогулке — свежая точка трека, до неё — последняя
  // известная системе, а если и её нет, то точка отсчёта: лучше показать
  // метку в примерном месте, чем не показать вовсе.
  const { point: knownPoint, locate } = useMyPosition();
  const myPoint = livePoint ?? knownPoint ?? origin;

  /*
    Уехал из города — карта не должна открываться на пустом дворе за
    тысячу километров. Точку отсчёта при этом не трогаем: на ней держится
    весь туман, меняется только то, куда смотрит камера.

    Один раз за открытие экрана: дальше человек двигает карту сам, и
    отнимать её у него — худшее, что можно сделать.
    */
  const jumped = useRef(false);

  useEffect(() => {
    if (jumped.current) return;
    if (!isAwayFromHome(origin, knownPoint)) return;

    jumped.current = true;
    cameraRef.current?.flyTo({
      center: [knownPoint!.lng, knownPoint!.lat],
      zoom: CLOSE_ZOOM,
      duration: 0,
    });
  }, [knownPoint, origin.lat, origin.lng]);


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
        name={displayName}
        avatar={avatar}
        title={levelTitle(level)}
        streakDays={streakDays}
        topInset={insets.top}
      />

      <View style={styles.barWrap}>
        <XpBar
          ratio={xp / levelXpRequirement(level)}
          label={`${xp} / ${levelXpRequirement(level)} XP`}
        />
      </View>

      <View style={styles.mapWrap}>
        <MapStack
          ref={cameraRef}
          camera={camera}
          origin={origin}
          geometry={geometry}
          myPoint={myPoint}
          tracking={tracking}
          friends={friends}
          places={places}
          myAvatar={avatar}
          myName={displayName}
        >
          <Pressable
            onPress={() => router.push('/map-full')}
            hitSlop={spacing.sm}
            style={({ pressed }) => [styles.expand, pressed && styles.locatePressed]}
            accessibilityRole="button"
            accessibilityLabel="Открыть карту во весь экран"
          >
            <Feather name="maximize-2" size={24} color={palette.textDark} />
          </Pressable>

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
            <Pressable
              onPress={() => router.push('/places')}
              accessibilityRole="button" accessibilityLabel="Открыть квест дня"
            >
              <QuestCard today={quest} compact />
            </Pressable>

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
    borderWidth: line,
    borderColor: palette.edgeSoft,
    overflow: 'hidden',
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
    borderWidth: line,
    borderColor: palette.edgeSoft,
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
    borderWidth: line,
    borderColor: palette.edgeSoft,
    backgroundColor: palette.parchmentBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locatePressed: { ...pressStyle },
  overlayBottom: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    gap: spacing.sm,
  },
  liveRow: { alignItems: 'center', gap: 2 },
  liveText: { color: palette.parchment, fontSize: text.meta, fontVariant: ['tabular-nums'] },
});
