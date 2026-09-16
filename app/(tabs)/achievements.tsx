import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { buildSnapshot, countCells, unlockedAchievements } from '@/core/db/repo';
import { ACHIEVEMENTS } from '@/core/rules/achievements';
import { palette, radii, spacing } from '@/core/theme/tokens';
import { useWalkStore } from '@/store/useWalkStore';

export default function AchievementsScreen() {
  const insets = useSafeAreaInsets();
  // exploredCells в зависимостях, чтобы список пересчитывался после прогулки.
  const exploredCells = useWalkStore((s) => s.exploredCells);

  const { snapshot, unlocked } = useMemo(
    () => ({
      snapshot: buildSnapshot(Math.max(1, countCells())),
      unlocked: unlockedAchievements(),
    }),
    [exploredCells],
  );

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
    >
      <Text style={styles.heading}>АЧИВКИ</Text>

      {ACHIEVEMENTS.map((achievement) => {
        const { current, target } = achievement.progress(snapshot);
        const done = unlocked.has(achievement.code);
        const ratio = Math.min(1, target > 0 ? current / target : 0);

        return (
          <View key={achievement.code} style={[styles.card, done && styles.cardDone]}>
            <View style={styles.row}>
              <Text style={styles.title}>{achievement.title}</Text>
              <Text style={styles.reward}>+{achievement.xpReward} XP</Text>
            </View>
            <Text style={styles.description}>{achievement.description}</Text>

            <View style={styles.track}>
              <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
            </View>
            <Text style={styles.progress}>
              {done ? 'Получено' : `${Math.min(current, target)} / ${target}`}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.fogSoft },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  heading: {
    color: palette.textOnDark,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  card: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 3,
    borderColor: palette.ink,
    backgroundColor: palette.parchment,
    gap: 6,
  },
  cardDone: { backgroundColor: palette.gold },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: palette.textDark, fontWeight: '900', fontSize: 16 },
  reward: { color: palette.textMuted, fontWeight: '800', fontVariant: ['tabular-nums'] },
  description: { color: palette.textMuted },
  track: {
    height: 10,
    borderRadius: radii.pill,
    backgroundColor: '#00000022',
    overflow: 'hidden',
    marginTop: 4,
  },
  fill: { height: '100%', backgroundColor: palette.ember },
  progress: { color: palette.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
});
