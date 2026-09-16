/**
 * Мелкие элементы из макета: полосатый прогресс-бар, чип, тост, кнопка.
 * Все — без внешних зависимостей, чтобы скелет ставился одной командой.
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

import { palette, radii, spacing } from '@/core/theme/tokens';

export function XpBar({ ratio }: { ratio: number }) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(Math.max(0, Math.min(1, ratio)), { duration: 450 });
  }, [ratio, width]);

  const fill = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));

  return (
    <View style={styles.barTrack}>
      <Animated.View style={[styles.barFill, fill]}>
        {/* Диагональная штриховка из макета — набор наклонных полосок. */}
        <View style={styles.hatchRow}>
          {Array.from({ length: 40 }).map((_, index) => (
            <View key={index} style={styles.hatch} />
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

export function Chip({
  label,
  icon,
  style,
}: {
  label: string;
  icon?: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.chip, style]}>
      {icon}
      <Text style={styles.chipText}>{label}</Text>
    </View>
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
    <Animated.View entering={FadeInDown} exiting={FadeOutDown} style={styles.toast}>
      <View style={styles.toastIcon}>
        <Text style={styles.toastIconText}>🏆</Text>
      </View>
      <View style={styles.toastBody}>
        <Text style={styles.toastTitle}>{title}</Text>
        <Text style={styles.toastSubtitle}>{subtitle}</Text>
      </View>
      <Pressable onPress={onDismiss} hitSlop={12} style={styles.toastClose}>
        <Text style={styles.toastCloseText}>✕</Text>
      </Pressable>
    </Animated.View>
  );
}

export function ActionButton({
  label,
  onPress,
  tone = 'primary',
  disabled,
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'ghost';
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        tone === 'ghost' && styles.buttonGhost,
        pressed && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text style={[styles.buttonText, tone === 'ghost' && styles.buttonTextGhost]}>{label}</Text>
    </Pressable>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  barTrack: {
    height: 26,
    borderRadius: radii.pill,
    borderWidth: 3,
    borderColor: palette.ink,
    backgroundColor: palette.parchmentBright,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: palette.ember,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  hatchRow: { flexDirection: 'row', gap: 8, paddingLeft: 4 },
  hatch: {
    width: 3,
    height: 60,
    backgroundColor: palette.emberDeep,
    opacity: 0.5,
    transform: [{ rotate: '20deg' }],
  },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 3,
    borderColor: palette.ink,
    backgroundColor: palette.parchmentBright,
  },
  chipText: { color: palette.textDark, fontWeight: '800', letterSpacing: 1 },

  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 3,
    borderColor: palette.ink,
    backgroundColor: palette.parchmentBright,
  },
  toastIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.sm,
    borderWidth: 3,
    borderColor: palette.ink,
    backgroundColor: palette.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastIconText: { fontSize: 20 },
  toastBody: { flex: 1 },
  toastTitle: { color: palette.textDark, fontWeight: '900', fontSize: 16 },
  toastSubtitle: { color: palette.textMuted, marginTop: 2, fontVariant: ['tabular-nums'] },
  toastClose: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    borderWidth: 3,
    borderColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastCloseText: { color: palette.textDark, fontWeight: '900' },

  button: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 3,
    borderColor: palette.ink,
    backgroundColor: palette.ember,
    alignItems: 'center',
  },
  buttonGhost: { backgroundColor: palette.parchmentBright },
  buttonPressed: { transform: [{ translateY: 2 }] },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: palette.textOnDark, fontWeight: '900', letterSpacing: 1 },
  buttonTextGhost: { color: palette.textDark },

  stat: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 3,
    borderColor: palette.ink,
    backgroundColor: palette.parchmentBright,
  },
  statValue: {
    color: palette.textDark,
    fontSize: 22,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  statLabel: { color: palette.textMuted, marginTop: 2, fontSize: 12, letterSpacing: 1 },
});
