import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { buildSnapshot, countCells, getProfile } from '@/core/db/repo';
import { formatPercent } from '@/core/geo/coverage';
import { totalXp } from '@/core/rules/xp';
import { palette, spacing } from '@/core/theme/tokens';
import { useCoverage } from '@/features/fog/useFog';
import { buildLeaderboard, DEMO_SHARED_CELLS, type FriendRow } from '@/features/friends/demo';
import { Glass, Orb, SkyBackdrop, type GlassTone } from '@/ui/aero';
import { ScreenHeader } from '@/ui/headers';
import { Chip } from '@/ui/widgets';
import { useWalkStore } from '@/store/useWalkStore';

/** Первое место — золото, второе — серебро, дальше обычное стекло. */
function toneForRank(row: FriendRow, rank: number): GlassTone {
  if (row.isYou) return 'light';
  return rank === 1 ? 'gold' : 'light';
}

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const exploredCells = useWalkStore((s) => s.exploredCells);
  const level = useWalkStore((s) => s.level);
  const xp = useWalkStore((s) => s.xp);

  const profile = getProfile();
  const snapshot = useMemo(() => buildSnapshot(Math.max(1, countCells())), [exploredCells]);

  const origin =
    profile.originLat != null && profile.originLng != null
      ? { lat: profile.originLat, lng: profile.originLng }
      : null;
  const coverage = useCoverage(origin, exploredCells);

  // Строка «вы» — настоящая, остальные пять из фикстуры.
  const rows = useMemo(
    () =>
      buildLeaderboard({
        name: 'Вы',
        distanceM: snapshot.totalDistanceM,
        coverageRatio: coverage.ratio,
        xp: totalXp({ level, xp }),
      }),
    [coverage.ratio, level, snapshot.totalDistanceM, xp],
  );

  const yourRank = rows.findIndex((r) => r.isYou) + 1;

  return (
    <View style={styles.root}>
      <SkyBackdrop />

      <View style={{ paddingTop: insets.top }}>
        <ScreenHeader
          title="ДРУЗЬЯ"
          subtitle={`${rows.length} в пути · вы ${yourRank}-й`}
          right={
            <Orb size={54} tone="lime">
              <Feather name="user-plus" size={25} color={palette.textOnLime} />
            </Orb>
          }
        />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Chip
          label="ДЕМО-ДАННЫЕ · БЭКЕНДА ПОКА НЕТ"
          icon={<Feather name="alert-circle" size={14} color={palette.textOnGold} />}
          tone="gold"
        />

        {rows.map((row, index) => {
          const rank = index + 1;
          return (
            <Glass
              key={row.id}
              tone={toneForRank(row, rank)}
              ring={row.isYou ? palette.aqua : undefined}
            >
              <View style={styles.row}>
                <Text style={[styles.rank, rank === 1 && styles.rankGold]}>{rank}</Text>

                <Orb size={40} tone={rank === 1 ? 'gold' : row.isYou ? 'aqua' : 'light'}>
                  {row.isYou ? (
                    <Feather name="user" size={20} color={palette.textOnGlass} />
                  ) : (
                    <Text style={[styles.initial, rank === 1 && styles.initialGold]}>
                      {row.name.slice(0, 1)}
                    </Text>
                  )}
                </Orb>

                <View style={styles.body}>
                  <Text style={[styles.name, rank === 1 && styles.nameGold]}>{row.name}</Text>
                  <Text style={[styles.meta, rank === 1 && styles.metaGold]}>
                    {(row.distanceM / 1000).toFixed(1)} км · открыто{' '}
                    {formatPercent(row.coverageRatio)}
                  </Text>
                </View>

                <Text style={[styles.xp, rank === 1 && styles.nameGold]}>{row.xp} XP</Text>
              </View>
            </Glass>
          );
        })}

        <Glass tone="dark">
          <View style={styles.shared}>
            <Orb size={44} tone="aqua">
              <Feather name="layers" size={21} color={palette.textOnGlass} />
            </Orb>
            <View style={styles.body}>
              <Text style={styles.sharedTitle}>Общая территория</Text>
              <Text style={styles.sharedBody}>
                С лидером у вас {DEMO_SHARED_CELLS} общих ячеек. Остальное каждый открыл сам.
              </Text>
            </View>
          </View>
        </Glass>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.skyMid },
  content: { padding: spacing.md, gap: 9, paddingBottom: spacing.xxl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  rank: {
    width: 18,
    color: palette.textMuted,
    fontWeight: '900',
    fontSize: 16,
    fontVariant: ['tabular-nums'],
  },
  rankGold: { color: palette.textOnGoldMuted },
  initial: { color: palette.textOnGlass, fontWeight: '900', fontSize: 17 },
  initialGold: { color: palette.textOnGold },
  body: { flex: 1 },
  name: { color: palette.textOnGlass, fontWeight: '900', fontSize: 15.5 },
  nameGold: { color: palette.textOnGold },
  meta: {
    color: palette.textMuted,
    fontSize: 12.5,
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },
  metaGold: { color: palette.textOnGoldMuted },
  xp: {
    color: palette.textMuted,
    fontWeight: '900',
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  shared: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  sharedTitle: { color: palette.white, fontWeight: '900', fontSize: 15 },
  sharedBody: {
    color: palette.textOnDark,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
});
