import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { resetDatabase } from '@/core/db/client';
import { buildSnapshot, countCells, getProfile } from '@/core/db/repo';
import { formatPercent } from '@/core/geo/coverage';
import { currentStreak, deviceTimeZone, localDateKey } from '@/core/rules/streak';
import { levelXpRequirement, totalXp } from '@/core/rules/xp';
import { palette, spacing } from '@/core/theme/tokens';
import { useCoverage } from '@/features/fog/useFog';
import { Glass, Orb, SkyBackdrop } from '@/ui/aero';
import { ScreenHeader } from '@/ui/headers';
import { ActionButton, Stat, XpBar } from '@/ui/widgets';
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

  const required = levelXpRequirement(level);

  return (
    <View style={styles.root}>
      <SkyBackdrop />

      <View style={{ paddingTop: insets.top }}>
        <ScreenHeader title="ПРОФИЛЬ">
          <View style={styles.identity}>
            <View>
              <Orb size={66} tone="aqua">
                <Feather name="user" size={30} color="#04405F" />
              </Orb>
              <View style={styles.levelBadge}>
                <Text style={styles.levelBadgeText}>{level}</Text>
              </View>
            </View>

            <View style={styles.identityBody}>
              <Text style={styles.identityTitle}>Ночной бродяга</Text>
              <Text style={styles.identityMeta}>
                До уровня {level + 1} осталось {required - xp} XP
              </Text>
              <View style={styles.identityBar}>
                <XpBar ratio={xp / required} height={16} />
              </View>
            </View>
          </View>
        </ScreenHeader>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
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
          <Stat label="ЯЧЕЕК H3" value={String(snapshot.exploredCells)} />
          <Stat label="ОТКРЫТО" value={formatPercent(coverage.ratio)} tone="lime" />
        </View>

        <Glass tone="dark">
          <View style={styles.note}>
            <View style={styles.noteHead}>
              <Feather name="lock" size={17} color={palette.gold} />
              <Text style={styles.noteTitle}>Данные хранятся только на устройстве</Text>
            </View>
            <Text style={styles.noteBody}>
              Сервера нет: история прогулок не покидает телефон. Синхронизация между
              устройствами появится вместе с бэкендом — схема БД к ней уже готова.
              До тех пор смена телефона означает потерю прогресса.
            </Text>
            <Text style={styles.noteMeta}>Таймзона: {timeZone}</Text>
          </View>
        </Glass>

        <ActionButton
          label="СБРОСИТЬ ПРОГРЕСС"
          tone="danger"
          icon={<Feather name="trash-2" size={17} color={palette.dangerText} />}
          onPress={() => {
            resetDatabase();
            hydrate();
          }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.skyMid },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: spacing.md },
  identityBody: { flex: 1 },
  identityTitle: {
    color: palette.white,
    fontWeight: '900',
    fontSize: 19,
    textShadowColor: 'rgba(3,45,72,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  identityMeta: {
    color: '#E4F8FF',
    fontSize: 13,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  identityBar: { marginTop: spacing.sm },
  levelBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    minWidth: 26,
    height: 26,
    paddingHorizontal: 5,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.limeDeep,
    borderWidth: 1.5,
    borderColor: palette.white,
  },
  levelBadgeText: { color: palette.textOnLime, fontWeight: '900', fontSize: 13 },
  content: { padding: spacing.md, gap: 10, paddingBottom: spacing.xxl },
  row: { flexDirection: 'row', gap: 10 },
  note: { padding: spacing.md + 2, gap: 7 },
  noteHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  noteTitle: { color: palette.gold, fontWeight: '900', fontSize: 14.5, flex: 1 },
  noteBody: { color: palette.textOnDark, lineHeight: 20, fontSize: 13 },
  noteMeta: {
    color: palette.textOnDarkMuted,
    fontSize: 12.5,
    fontVariant: ['tabular-nums'],
  },
});
