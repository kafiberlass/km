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
import { palette, spacing } from '@/core/theme/tokens';
import { FogLayer, type SharedCamera } from '@/features/fog/FogLayer';
import { useCoverage, useFogGeometry } from '@/features/fog/useFog';
import { MapCanvas } from '@/features/map/MapCanvas';
import { DEMO_CENTER } from '@/features/places/seed';
import { ActionButton, Chip, Toast, XpBar } from '@/ui/widgets';
import { SunsetHeader } from '@/ui/SunsetHeader';
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
      <View style={{ paddingTop: insets.top }}>
        <SunsetHeader
          level={level}
          title="Ночной бродяга"
          xp={xp}
          xpRequired={levelXpRequirement(level)}
          streakDays={streakDays}
        />
      </View>

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

        <View style={styles.overlayTop} pointerEvents="box-none">
          <Chip
            label={`ОТКРЫТО ${formatPercent(coverage.ratio)}`}
            icon={<Feather name="map" size={16} color={palette.textDark} />}
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
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.fogSoft },
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
  devLink: {
    color: palette.parchment,
    fontWeight: '900',
    letterSpacing: 1,
    padding: spacing.sm,
  },
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
