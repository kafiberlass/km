/**
 * Мелкие элементы Aero: полосатый прогресс-бар, чип, тост, кнопка, плитка.
 *
 * Шрифты намеренно не задаются: в tokens.fonts объявлены Titillium Web и
 * Source Sans 3, но файлов в assets/fonts пока нет, а fontFamily на
 * незагруженный шрифт на Android ломает отрисовку текста. Когда файлы
 * появятся — достаточно будет добавить fontFamily сюда.
 */

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  FadeInDown,
  FadeOutDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

import { palette, radii, spacing } from '@/core/theme/tokens';
import { Glass, Orb, type GlassTone } from './aero';

/**
 * XP-бар: лаймовая заливка с диагональной штриховкой под 115° —
 * прямая цитата из прогресс-бара Vista, ради неё всё и затевалось.
 */
export function XpBar({ ratio, height = 22 }: { ratio: number; height?: number }) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(Math.max(0, Math.min(1, ratio)), { duration: 450 });
  }, [ratio, width]);

  const fill = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));

  return (
    <View style={[styles.barTrack, { height, borderRadius: height }]}>
      <Animated.View style={[styles.barFill, { borderRadius: height }, fill]}>
        <View style={styles.hatchRow}>
          {Array.from({ length: 40 }).map((_, index) => (
            <View key={index} style={styles.hatch} />
          ))}
        </View>
        {/* Блик по верхней кромке заливки — стекло поверх лайма. */}
        <View style={styles.barGloss} />
      </Animated.View>
    </View>
  );
}

export function Chip({
  label,
  icon,
  tone = 'light',
  style,
}: {
  label: string;
  icon?: React.ReactNode;
  tone?: GlassTone;
  style?: ViewStyle;
}) {
  const dark = tone === 'dark';
  return (
    <Glass tone={tone} radius={radii.pill} style={[styles.chipOuter, style as ViewStyle]}>
      <View style={styles.chipInner}>
        {icon}
        <Text style={[styles.chipText, dark && styles.chipTextDark]}>{label}</Text>
      </View>
    </Glass>
  );
}

export function Toast({
  title,
  subtitle,
  onDismiss,
}: {
  title: string;
  subtitle: string;
  onDismiss: () => void;
}) {
  return (
    <Animated.View entering={FadeInDown} exiting={FadeOutDown}>
      <Glass tone="gold" raised>
        <View style={styles.toast}>
          <Orb size={44} tone="gold">
            <Feather name="award" size={21} color="#5B3B02" />
          </Orb>

          <View style={styles.toastBody}>
            <Text style={styles.toastTitle}>{title}</Text>
            <Text style={styles.toastSubtitle}>{subtitle}</Text>
          </View>

          <Pressable onPress={onDismiss} hitSlop={12} style={styles.toastClose}>
            <Feather name="x" size={15} color={palette.textOnGoldMuted} />
          </Pressable>
        </View>
      </Glass>
    </Animated.View>
  );
}

export type ButtonTone = 'primary' | 'ghost' | 'danger';

export function ActionButton({
  label,
  onPress,
  tone = 'primary',
  disabled,
  icon,
}: {
  label: string;
  onPress: () => void;
  tone?: ButtonTone;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  const glassTone: GlassTone = tone === 'primary' ? 'lime' : tone === 'danger' ? 'danger' : 'idle';
  const textColor =
    tone === 'primary'
      ? palette.textOnLime
      : tone === 'danger'
        ? palette.dangerText
        : palette.textOnGlass;

  return (
    <Pressable onPress={onPress} disabled={disabled} style={disabled && styles.buttonDisabled}>
      {({ pressed }) => (
        <Glass
          tone={glassTone}
          radius={radii.pill}
          raised={!pressed}
          style={styles.buttonOuter}
        >
          <View style={[styles.buttonInner, pressed && styles.buttonPressed]}>
            {icon}
            <Text style={[styles.buttonText, { color: textColor }]}>{label}</Text>
          </View>
        </Glass>
      )}
    </Pressable>
  );
}

export function Stat({
  label,
  value,
  tone = 'light',
}: {
  label: string;
  value: string;
  tone?: GlassTone;
}) {
  const lime = tone === 'lime';
  return (
    <Glass tone={tone} radius={radii.md} style={styles.statOuter}>
      <View style={styles.statInner}>
        <Text style={[styles.statLabel, lime && styles.statLabelLime]}>{label}</Text>
        <Text style={[styles.statValue, lime && styles.statValueLime]}>{value}</Text>
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  barTrack: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    backgroundColor: 'rgba(4,36,58,0.45)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: palette.limeDeep,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  hatchRow: { flexDirection: 'row', gap: 8, paddingLeft: 4 },
  hatch: {
    width: 4,
    height: 60,
    backgroundColor: palette.limeLight,
    opacity: 0.38,
    transform: [{ rotate: '25deg' }],
  },
  barGloss: {
    position: 'absolute',
    top: 1,
    left: 2,
    right: 2,
    height: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },

  chipOuter: { alignSelf: 'flex-start' },
  chipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipText: {
    color: palette.textOnGlass,
    fontWeight: '800',
    fontSize: 12.5,
    letterSpacing: 0.8,
    fontVariant: ['tabular-nums'],
  },
  chipTextDark: { color: palette.textOnDark },

  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  toastBody: { flex: 1 },
  toastTitle: { color: palette.textOnGold, fontWeight: '900', fontSize: 16 },
  toastSubtitle: {
    color: palette.textOnGoldMuted,
    marginTop: 2,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  toastClose: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },

  buttonOuter: { width: '100%' },
  buttonInner: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  buttonPressed: { opacity: 0.9, transform: [{ translateY: 1 }] },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontWeight: '900', fontSize: 15, letterSpacing: 1.2 },

  statOuter: { flex: 1 },
  statInner: { paddingHorizontal: 13, paddingVertical: 10 },
  statLabel: {
    color: palette.textMuted,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.3,
  },
  statLabelLime: { color: '#33560A' },
  statValue: {
    color: palette.textOnGlass,
    fontSize: 25,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    lineHeight: 30,
  },
  statValueLime: { color: palette.textOnLime },
});
