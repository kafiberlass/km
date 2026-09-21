import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { buildSnapshot, countCells, unlockedAchievements } from '@/core/db/repo';
import { ACHIEVEMENTS } from '@/core/rules/achievements';
import { palette, spacing } from '@/core/theme/tokens';
import { Glass, Orb, SkyBackdrop } from '@/ui/aero';
import { ScreenHeader } from '@/ui/headers';
import { XpBar } from '@/ui/widgets';
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

  const collectedXp = ACHIEVEMENTS.filter((a) => unlocked.has(a.code)).reduce(
    (sum, a) => sum + a.xpReward,
    0,
  );

  return (
    <View style={styles.root}>
      <SkyBackdrop />

      <View style={{ paddingTop: insets.top }}>
        <ScreenHeader
          title="АЧИВКИ"
          subtitle={`Открыто ${unlocked.size} из ${ACHIEVEMENTS.length} · собрано ${collectedXp} XP`}
          right={
            <Orb size={54} tone="gold">
              <Feather name="award" size={26} color="#5B3B02" />
            </Orb>
          }
        />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {ACHIEVEMENTS.map((achievement) => {
          const { current, target } = achievement.progress(snapshot);
          const done = unlocked.has(achievement.code);
          const ratio = Math.min(1, target > 0 ? current / target : 0);

          return (
            <Glass key={achievement.code} tone={done ? 'gold' : 'light'}>
              <View style={styles.card}>
                <View style={styles.cardRow}>
                  <Orb size={44} tone={done ? 'gold' : 'aqua'}>
                    <Feather
                      name={done ? 'check' : 'target'}
                      size={21}
                      color={done ? '#5B3B02' : palette.textOnGlass}
                    />
                  </Orb>

                  <View style={styles.cardBody}>
                    <Text style={[styles.title, done && styles.titleDone]}>
                      {achievement.title}
                    </Text>
                    <Text style={[styles.description, done && styles.descriptionDone]}>
                      {achievement.description}
                      {done ? ' · получено' : ''}
                    </Text>
                  </View>

                  <Text style={[styles.reward, done && styles.rewardDone]}>
                    +{achievement.xpReward} XP
                  </Text>
                </View>

                {!done && (
                  <View style={styles.progressBlock}>
                    <XpBar ratio={ratio} height={12} />
                    <Text style={styles.progress}>
                      {Math.min(current, target)} / {target}
                    </Text>
                  </View>
                )}
              </View>
            </Glass>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.skyMid },
  content: { padding: spacing.md, gap: 9, paddingBottom: spacing.xxl },
  card: { padding: spacing.md - 2 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  cardBody: { flex: 1 },
  title: { color: palette.textOnGlass, fontWeight: '900', fontSize: 16 },
  titleDone: { color: palette.textOnGold },
  description: { color: palette.textMuted, marginTop: 1, fontSize: 13 },
  descriptionDone: { color: palette.textOnGoldMuted },
  reward: {
    color: palette.textMuted,
    fontWeight: '800',
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  rewardDone: { color: palette.textOnGold },
  progressBlock: { marginTop: 9, gap: 5 },
  progress: {
    color: palette.textMuted,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
});
