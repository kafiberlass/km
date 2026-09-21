/**
 * Шапки экранов.
 *
 * Небо сверху, трава по нижнему краю — линия горизонта, с которой
 * узнаётся вся эстетика. Размер шапки меряется по содержимому и отдаётся
 * в Skia: заранее его знать нельзя, вырезы у всех телефонов разные.
 */

import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { palette, radii, spacing } from '@/core/theme/tokens';
import { HeaderBackdrop, Orb } from './aero';

function useMeasured() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);
  return { size, onLayout };
}

interface SkyHeaderProps {
  level: number;
  title: string;
  xp: number;
  xpRequired: number;
  streakDays: number;
}

/** Шапка карты: уровень, звание, стрик. XP-бар живёт отдельно, под шапкой. */
export function SkyHeader({ level, title, xp, xpRequired, streakDays }: SkyHeaderProps) {
  const { size, onLayout } = useMeasured();

  return (
    <View style={styles.root} onLayout={onLayout}>
      <HeaderBackdrop width={size.width} height={size.height} />

      <View style={styles.row}>
        <Orb size={56} tone="aqua">
          <Text style={styles.badgeText}>КМ</Text>
        </Orb>

        <View style={styles.titleBlock}>
          <Text style={styles.title} numberOfLines={1}>
            УР.{level} {title.toUpperCase()}
          </Text>
          <Text style={styles.subtitle}>
            {xp} / {xpRequired} XP ДО УР.{level + 1}
          </Text>
        </View>

        <View style={styles.streak}>
          <MaterialCommunityIcons name="fire" size={16} color="#E07B1E" />
          <Text style={styles.streakValue}>{streakDays}</Text>
        </View>
      </View>
    </View>
  );
}

/** Шапка остальных вкладок: заголовок, строка статуса и круглый слот справа. */
export function ScreenHeader({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const { size, onLayout } = useMeasured();

  return (
    <View style={styles.root} onLayout={onLayout}>
      <HeaderBackdrop width={size.width} height={size.height} />

      <View style={styles.row}>
        <View style={styles.titleBlock}>
          <Text style={styles.heading}>{title}</Text>
          {subtitle != null && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        {right}
      </View>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    backgroundColor: palette.headerBottom,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    // Нижний отступ держит траву: она занимает 30 px по нижнему краю.
    paddingBottom: 30,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  badgeText: {
    color: '#04405F',
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: 1,
  },
  titleBlock: { flex: 1 },
  heading: {
    color: palette.white,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 1.5,
    textShadowColor: 'rgba(3,45,72,0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  title: {
    color: palette.white,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(3,45,72,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  subtitle: {
    color: '#E4F8FF',
    fontSize: 13,
    letterSpacing: 0.8,
    marginTop: 3,
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(3,45,72,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: palette.glassEdge,
    backgroundColor: palette.glassTop,
  },
  streakValue: { color: '#05405F', fontWeight: '900', fontSize: 15 },
});
