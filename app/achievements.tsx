import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

import { buildSnapshot, countCells, unlockedAchievements } from '@/core/db/repo';
import { ACHIEVEMENTS } from '@/core/rules/achievements';
import { fonts, palette, radii, spacing } from '@/core/theme/tokens';
import { badgeFor } from '@/ui/badges';
import { ScreenHeader } from '@/ui/ScreenHeader';
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
    <View style={styles.root}>
      <ScreenHeader
        title="Достижения"
        subtitle={`${unlocked.size} из ${ACHIEVEMENTS.length} открыто`}
        topInset={insets.top}
        onClose={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.grid}>
          {ACHIEVEMENTS.map((achievement) => {
            const { current, target } = achievement.progress(snapshot);
            const done = unlocked.has(achievement.code);
            const ratio = Math.min(1, target > 0 ? current / target : 0);
            const badge = badgeFor(achievement.code);
            // Полоса нужна там, где до цели идут шагами. Для ачивок вида
            // «сделай это один раз» она всегда либо пустая, либо полная.
            const showProgress = !done && target > 1;

            return (
              <View key={achievement.code} style={[styles.card, !done && styles.cardLocked]}>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: done ? badge.color : palette.sand },
                  ]}
                >
                  <Feather
                    name={done ? badge.icon : 'lock'}
                    size={22}
                    color={done ? palette.parchmentBright : palette.textMuted}
                  />
                </View>

                <Text style={[styles.title, !done && styles.textLocked]} numberOfLines={2}>
                  {achievement.title.toUpperCase()}
                </Text>
                <Text style={[styles.description, !done && styles.textLocked]}>
                  {achievement.description}
                </Text>

                {showProgress && (
                  <>
                    <View style={styles.track}>
                      <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
                    </View>
                    <Text style={styles.progress}>
                      {Math.min(current, target)} / {target}
                    </Text>
                  </>
                )}

                {done && <Text style={styles.reward}>+{achievement.xpReward} XP</Text>}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const CARD_GAP = spacing.md;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.dune },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: CARD_GAP },
  card: {
    // Два столбца: 48% ширины каждому, остаток забирает зазор между ними.
    // flexGrow достраивает последнюю карточку, если она в ряду одна.
    flexBasis: '48%',
    flexGrow: 1,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 3,
    borderColor: palette.ink,
    backgroundColor: palette.parchmentBright,
    gap: 6,
  },
  cardLocked: { backgroundColor: palette.sand },
  badge: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    borderWidth: 3,
    borderColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: { color: palette.textDark, fontFamily: fonts.display, fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },
  description: {
    fontFamily: fonts.body, color: palette.textMuted, fontSize: 12, lineHeight: 16 },
  textLocked: { opacity: 0.65 },
  track: {
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: '#00000022',
    overflow: 'hidden',
    marginTop: 4,
  },
  fill: { height: '100%', backgroundColor: palette.ember },
  progress: { color: palette.textMuted, fontSize: 11, fontVariant: ['tabular-nums'] },
  reward: { color: palette.emberDeep, fontSize: 12, fontFamily: fonts.display, fontWeight: '900' },
});
