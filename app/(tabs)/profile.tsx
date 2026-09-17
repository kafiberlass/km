import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Link } from 'expo-router';

import { resetDatabase } from '@/core/db/client';
import { buildSnapshot, countCells, getProfile, unlockedAchievements } from '@/core/db/repo';
import { formatPercent } from '@/core/geo/coverage';
import { ACHIEVEMENTS } from '@/core/rules/achievements';
import { currentStreak, deviceTimeZone, localDateKey } from '@/core/rules/streak';
import { levelXpRequirement } from '@/core/rules/xp';
import { palette, radii, spacing } from '@/core/theme/tokens';
import { useCoverage } from '@/features/fog/useFog';
import { badgeFor } from '@/ui/badges';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { ActionButton } from '@/ui/widgets';
import { useWalkStore } from '@/store/useWalkStore';

/** Титулов по уровням ещё нет — он один на всё приложение, как и на карте. */
const LEVEL_TITLE = 'Ночной бродяга';

/** Сколько плиток ачивок помещается в строку профиля до «+N». */
const RECENT_BADGES = 3;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const exploredCells = useWalkStore((s) => s.exploredCells);
  const level = useWalkStore((s) => s.level);
  const xp = useWalkStore((s) => s.xp);
  const hydrate = useWalkStore((s) => s.hydrate);

  const profile = getProfile();
  const { snapshot, unlocked } = useMemo(
    () => ({
      snapshot: buildSnapshot(Math.max(1, countCells())),
      unlocked: unlockedAchievements(),
    }),
    [exploredCells],
  );

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

  // Порядок ачивок в списке правил заодно задаёт порядок плиток: свежие
  // окажутся в конце, поэтому показываем последние полученные.
  const earned = ACHIEVEMENTS.filter((a) => unlocked.has(a.code));
  const shown = earned.slice(-RECENT_BADGES);
  const rest = earned.length - shown.length;

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={LEVEL_TITLE}
        subtitle={`Уровень ${level} · ${streak} дней подряд`}
        topInset={insets.top}
        avatar={
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>КМ</Text>
          </View>
        }
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.tiles}>
          <Tile
            value={(snapshot.totalDistanceM / 1000).toFixed(1)}
            label="км пройдено"
            color={palette.emberDeep}
          />
          <Tile value={formatPercent(coverage.ratio)} label="открыто" color={palette.teal} />
          <Tile value={String(streak)} label="дней подряд" color={palette.emberDeep} />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>ПОСЛЕДНИЕ АЧИВКИ</Text>
            <Link href="/achievements" style={styles.cardLink}>
              ВСЕ ›
            </Link>
          </View>

          <View style={styles.badgeRow}>
            {shown.map((achievement) => {
              const badge = badgeFor(achievement.code);
              return (
                <View
                  key={achievement.code}
                  style={[styles.badge, { backgroundColor: badge.color }]}
                >
                  <Feather name={badge.icon} size={22} color={palette.parchmentBright} />
                </View>
              );
            })}

            {/* Пустая пунктирная плитка: сколько ещё ачивок не поместилось
                или, пока их нет вовсе, сколько всего можно получить. */}
            <View style={[styles.badge, styles.badgeMore]}>
              <Text style={styles.badgeMoreText}>
                +{rest > 0 ? rest : ACHIEVEMENTS.length - earned.length}
              </Text>
            </View>
          </View>
        </View>

        <Link href="/dev" asChild>
          <Pressable style={({ pressed }) => [styles.settings, pressed && styles.settingsPressed]}>
            <Feather name="settings" size={18} color={palette.parchmentBright} />
            <Text style={styles.settingsText}>НАСТРОЙКИ</Text>
          </Pressable>
        </Link>

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
    </View>
  );
}

function Tile({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <View style={styles.tile}>
      <Text style={[styles.tileValue, { color }]}>{value}</Text>
      <Text style={styles.tileLabel}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.dune },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },

  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: palette.ink,
    backgroundColor: palette.parchmentBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: palette.textDark, fontWeight: '900', fontSize: 22, letterSpacing: 1 },

  tiles: { flexDirection: 'row', gap: spacing.sm },
  tile: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 3,
    borderColor: palette.ink,
    backgroundColor: palette.parchmentBright,
    alignItems: 'center',
    gap: 4,
  },
  tileValue: { fontSize: 24, fontWeight: '900', fontVariant: ['tabular-nums'] },
  tileLabel: { color: palette.textMuted, fontSize: 10, letterSpacing: 1, textAlign: 'center' },

  card: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 3,
    borderColor: palette.ink,
    backgroundColor: palette.parchmentBright,
    gap: spacing.md,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: palette.textDark, fontWeight: '900', letterSpacing: 1 },
  cardLink: { color: palette.emberDeep, fontWeight: '900', letterSpacing: 1 },
  badgeRow: { flexDirection: 'row', gap: spacing.sm },
  badge: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    borderWidth: 3,
    borderColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeMore: {
    backgroundColor: palette.sand,
    borderStyle: 'dashed',
    borderColor: palette.textMuted,
  },
  badgeMoreText: { color: palette.textMuted, fontWeight: '900' },

  settings: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 3,
    borderColor: palette.ink,
    backgroundColor: palette.bark,
  },
  settingsPressed: { transform: [{ translateY: 2 }] },
  settingsText: { color: palette.parchmentBright, fontWeight: '900', letterSpacing: 1 },

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
