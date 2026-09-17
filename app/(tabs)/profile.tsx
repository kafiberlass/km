import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { resetDatabase } from '@/core/db/client';
import { buildSnapshot, countCells, getProfile } from '@/core/db/repo';
import { formatPercent } from '@/core/geo/coverage';
import { currentStreak, deviceTimeZone, localDateKey } from '@/core/rules/streak';
import { levelXpRequirement, totalXp } from '@/core/rules/xp';
import { palette, radii, spacing } from '@/core/theme/tokens';
import { useCoverage } from '@/features/fog/useFog';
import { ActionButton, Stat } from '@/ui/widgets';
import { useWalkStore } from '@/store/useWalkStore';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const exploredCells = useWalkStore((s) => s.exploredCells);
  const level = useWalkStore((s) => s.level);
  const xp = useWalkStore((s) => s.xp);
  const hydrate = useWalkStore((s) => s.hydrate);

  const profile = getProfile();
  const snapshot = useMemo(() => buildSnapshot(Math.max(1, countCells())), [exploredCells]);

  const origin =
    profile.originLat != null && profile.originLng != null
      ? { lat: profile.originLat, lng: profile.originLng }
      : null;
  const coverage = useCoverage(origin, exploredCells);

  const timeZone = profile.timeZone === 'UTC' ? deviceTimeZone() : profile.timeZone;
  const streak = currentStreak(
    {
      streakDays: profile.streakDays,
      lastActiveDate: profile.lastActiveDate,
      bestStreak: profile.bestStreak,
    },
    localDateKey(Date.now(), timeZone),
  );

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
    >
      <Text style={styles.heading}>ПРОФИЛЬ</Text>

      <View style={styles.row}>
        <Stat label="УРОВЕНЬ" value={String(level)} />
        <Stat label="ВСЕГО XP" value={String(totalXp({ level, xp }))} />
      </View>
      <View style={styles.row}>
        <Stat label="СТРИК" value={`${streak} дн`} />
        <Stat label="РЕКОРД" value={`${profile.bestStreak} дн`} />
      </View>
      <View style={styles.row}>
        <Stat label="ПРОЙДЕНО" value={`${(snapshot.totalDistanceM / 1000).toFixed(1)} км`} />
        <Stat label="ПРОГУЛОК" value={String(snapshot.totalWalks)} />
      </View>
      <View style={styles.row}>
        <Stat label="ЯЧЕЕК" value={String(snapshot.exploredCells)} />
        <Stat label="ОТКРЫТО" value={formatPercent(coverage.ratio)} />
      </View>

      <View style={styles.note}>
        <Text style={styles.noteTitle}>Данные хранятся только на устройстве</Text>
        <Text style={styles.noteBody}>
          Сервера нет: история прогулок не покидает телефон. Синхронизация между
          устройствами появится вместе с бэкендом — схема БД к ней уже готова.
          До тех пор смена телефона означает потерю прогресса.
        </Text>
        <Text style={styles.noteBody}>
          До следующего уровня: {levelXpRequirement(level) - xp} XP · Таймзона: {timeZone}
        </Text>
      </View>

      <ActionButton
        label="СБРОСИТЬ ПРОГРЕСС"
        tone="ghost"
        onPress={() => {
          resetDatabase();
          hydrate();
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.dune },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  heading: { color: palette.textOnDark, fontSize: 24, fontWeight: '900', letterSpacing: 2 },
  row: { flexDirection: 'row', gap: spacing.md },
  note: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 3,
    borderColor: palette.ink,
    backgroundColor: palette.fog,
    gap: 6,
  },
  noteTitle: { color: palette.gold, fontWeight: '900' },
  noteBody: { color: palette.parchment, lineHeight: 20 },
});
