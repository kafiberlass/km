/**
 * Карточка квеста дня.
 *
 * Два вида. Полный — на вкладке «Места», где человек и решает, куда
 * пойти. Сжатый — на карте, одной строкой: там место дорого, но цель
 * дня должна быть видна без переходов по экранам.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { fonts, line, palette, radii, spacing, text } from '@/core/theme/tokens';

import type { TodayQuest } from './today';

const ICONS = {
  place: 'map-pin',
  district: 'grid',
  distance: 'trending-up',
} as const;

export function QuestCard({ today, compact = false }: { today: TodayQuest; compact?: boolean }) {
  const { quest, progress } = today;
  const icon = ICONS[quest.kind];

  if (compact) {
    return (
      <View style={[styles.compact, progress.done && styles.compactDone]}>
        <Feather
          name={progress.done ? 'check-circle' : icon}
          size={14}
          color={progress.done ? palette.teal : palette.gold}
        />
        <Text style={styles.compactText} numberOfLines={1}>
          {quest.title}
        </Text>
        <Text style={styles.compactValue}>{progress.label}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, progress.done && styles.cardDone]}>
      <View style={styles.head}>
        <View style={[styles.badge, progress.done && styles.badgeDone]}>
          <Feather
            name={progress.done ? 'check' : icon}
            size={18}
            color={palette.parchmentBright}
          />
        </View>

        <View style={styles.headText}>
          <Text style={styles.label}>
            {progress.done ? 'КВЕСТ ДНЯ ВЫПОЛНЕН' : 'КВЕСТ ДНЯ'}
          </Text>
          <Text style={styles.title}>{quest.title}</Text>
        </View>

        <Text style={styles.reward}>+{quest.xpReward}</Text>
      </View>

      <Text style={styles.hint}>{quest.hint}</Text>

      {/* Полоска только там, где есть чему расти: у «дойти до места»
          промежуточного состояния не бывает — либо дошёл, либо нет. */}
      {quest.kind !== 'place' && (
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              { width: `${Math.round(progress.ratio * 100)}%` },
              progress.done && styles.fillDone,
            ]}
          />
        </View>
      )}

      <Text style={styles.progress}>{progress.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: line,
    borderColor: palette.edgeSoft,
    backgroundColor: palette.parchmentBright,
    gap: spacing.sm,
  },
  cardDone: { backgroundColor: palette.parchment },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headText: { flex: 1, gap: 2 },
  badge: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    borderWidth: line,
    borderColor: palette.edgeSoft,
    backgroundColor: palette.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDone: { backgroundColor: palette.teal },
  label: {
    color: palette.textMuted,
    fontFamily: fonts.display,
    fontWeight: '900',
    fontSize: text.label,
    letterSpacing: 1,
  },
  title: { color: palette.textDark, fontFamily: fonts.display, fontWeight: '900', fontSize: text.cardTitle },
  reward: { color: palette.emberDeep, fontFamily: fonts.mono, fontSize: text.cardTitle },
  hint: { color: palette.textMuted, fontFamily: fonts.body, fontSize: text.meta },
  track: {
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: palette.edgeSoft,
    backgroundColor: palette.sand,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: palette.gold },
  fillDone: { backgroundColor: palette.teal },
  progress: {
    color: palette.textDark,
    fontFamily: fonts.mono,
    fontSize: text.body,
    fontVariant: ['tabular-nums'],
  },

  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: line,
    borderColor: palette.edgeSoft,
    backgroundColor: palette.parchmentBright,
  },
  compactDone: { backgroundColor: palette.parchment },
  compactText: {
    flexShrink: 1,
    color: palette.textDark,
    fontFamily: fonts.display,
    fontWeight: '700',
    fontSize: text.meta,
  },
  compactValue: {
    color: palette.emberDeep,
    fontFamily: fonts.mono,
    fontSize: text.meta,
    fontVariant: ['tabular-nums'],
  },
});
