/**
 * Главный экран — карта с туманом войны.
 *
 * Здесь сходятся три слоя:
 *   MapLibre (тайлы) -> Skia (туман) -> React (HUD).
 * Карта и туман синхронизируются через SharedValue камеры, без setState.
 */

import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedValue } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { Link } from 'expo-router';

import { getProfile } from '@/core/db/repo';
import { formatPercent } from '@/core/geo/coverage';
import { levelXpRequirement } from '@/core/rules/xp';
import { palette, radii, spacing } from '@/core/theme/tokens';
import { FogLayer, type SharedCamera } from '@/features/fog/FogLayer';
import { useCoverage, useFogGeometry } from '@/features/fog/useFog';
import { MapCanvas } from '@/features/map/MapCanvas';
import { DEMO_CENTER } from '@/features/places/seed';
import { Droplet, SkyBackdrop } from '@/ui/aero';
import { ActionButton, Chip, Toast, XpBar } from '@/ui/widgets';
import { SkyHeader } from '@/ui/headers';
import { useWalkStore } from '@/store/useWalkStore';

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const [size, setSize] = useState({ width: 0, height: 0 });

  const status = useWalkStore((s) => s.status);
  const level = useWalkStore((s) => s.level);
  const xp = useWalkStore((s) => s.xp);
  const streakDays = useWalkStore((s) => s.streakDays);
  const exploredCells = useWalkStore((s) => s.exploredCells);
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

  const tracking = status === 'tracking' || status === 'starting';
  const toggle = useCallback(() => {
    if (tracking) void stop();
    else void start();
  }, [start, stop, tracking]);

  return (
    <View style={styles.root}>
      <SkyBackdrop />

      <View style={{ paddingTop: insets.top }}>
        <SkyHeader
          level={level}
          title="Ночной бродяга"
          xp={xp}
          xpRequired={levelXpRequirement(level)}
          streakDays={streakDays}
        />
      </View>

      {/* XP-бар живёт под шапкой, а не в ней: низ шапки занимает трава. */}
      <View style={styles.barWrap}>
        <XpBar ratio={xp / levelXpRequirement(level)} />
      </View>

      <View style={styles.mapWrap}>
        <MapCanvas
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

        {/* Капли на стекле панели. На саму карту их не ставим: она не под стеклом. */}
        <Droplet size={13} style={styles.dropA} />
        <Droplet size={9} style={styles.dropB} />
        <Droplet size={7} style={styles.dropC} />

        <View style={styles.overlayTop} pointerEvents="box-none">
          <Chip
            label={`ОТКРЫТО ${formatPercent(coverage.ratio)}`}
            icon={<Feather name="map" size={15} color={palette.textOnGlass} />}
          />
          <Link href="/dev" asChild>
            <Text style={styles.devLink}>DEV</Text>
          </Link>
        </View>

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
            icon={
              <Feather
                name={tracking ? 'square' : 'play'}
                size={17}
                color={tracking ? palette.textOnGlass : palette.textOnLime}
              />
            }
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.skyMid },
  barWrap: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  mapWrap: {
    flex: 1,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: palette.glassEdge,
    overflow: 'hidden',
  },
  dropA: { position: 'absolute', right: 14, top: 196 },
  dropB: { position: 'absolute', right: 30, top: 240 },
  dropC: { position: 'absolute', right: 20, top: 286 },
  overlayTop: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  devLink: {
    color: palette.textOnDark,
    fontWeight: '900',
    letterSpacing: 1.2,
    fontSize: 12,
    overflow: 'hidden',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: palette.darkGlassEdge,
    backgroundColor: palette.darkGlassTop,
  },
  overlayBottom: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    gap: spacing.sm,
  },
  liveRow: { alignItems: 'center' },
  liveText: {
    color: palette.textOnDark,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    overflow: 'hidden',
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: palette.darkGlassEdge,
    backgroundColor: palette.darkScrim,
  },
});
