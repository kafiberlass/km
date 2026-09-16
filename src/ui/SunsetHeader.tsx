/**
 * Шапка с закатом из макета.
 *
 * Полосы рисуются обычными View, а не градиентом: в макете это именно
 * дискретные полосы, и так не нужна ни expo-linear-gradient, ни SVG.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { palette, radii, spacing, sunsetBands } from '@/core/theme/tokens';

interface Props {
  level: number;
  title: string;
  xp: number;
  xpRequired: number;
  streakDays: number;
}

export function SunsetHeader({ level, title, xp, xpRequired, streakDays }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.bands}>
        {sunsetBands.map((color) => (
          <View key={color} style={[styles.band, { backgroundColor: color }]} />
        ))}
        {/* Солнце: круг, наполовину утопленный за горизонт. */}
        <View style={styles.sun} />
        <View style={styles.horizon} />
      </View>

      <View style={styles.content}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>КМ</Text>
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.title} numberOfLines={1}>
            УР.{level} {title.toUpperCase()}
          </Text>
          <Text style={styles.subtitle}>
            {xp} / {xpRequired} XP ДО УР.{level + 1}
          </Text>
        </View>

        <View style={styles.streak}>
          <Text style={styles.streakIcon}>🔥</Text>
          <Text style={styles.streakValue}>{streakDays}</Text>
        </View>
      </View>
    </View>
  );
}

const BAND_HEIGHT = 22;

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
    borderBottomLeftRadius: radii.lg,
    borderBottomRightRadius: radii.lg,
    backgroundColor: palette.plum,
  },
  bands: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  band: { height: BAND_HEIGHT, width: '100%' },
  sun: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 18,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F7E27E',
  },
  horizon: {
    position: 'absolute',
    left: -40,
    right: -40,
    bottom: -60,
    height: 120,
    backgroundColor: palette.ink,
    transform: [{ rotate: '4deg' }],
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  badge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: palette.parchmentBright,
    borderWidth: 3,
    borderColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: palette.textDark, fontWeight: '900', fontSize: 18, letterSpacing: 1 },
  titleBlock: { flex: 1 },
  title: {
    color: palette.textOnDark,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: palette.parchment,
    fontSize: 12,
    letterSpacing: 1.5,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: palette.ink,
    backgroundColor: '#3A2A1E',
  },
  streakIcon: { fontSize: 14 },
  streakValue: { color: palette.gold, fontWeight: '900', fontSize: 16 },
});
