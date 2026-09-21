/**
 * Мелкие элементы: полоса опыта, чип, тост, кнопка, плитка.
 *
 * Все — без внешних зависимостей. Стекло и блики собраны из обычных View
 * с полупрозрачным белым: нативные градиенты и размытие потребовали бы
 * пересборки приложения у всех, у кого оно уже стоит.
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

import { fonts, line, palette, radii, shadow, spacing } from '@/core/theme/tokens';
import { Gloss } from './Gloss';

export function XpBar({
  ratio,
  label,
}: {
  ratio: number;
  /** Подпись поверх полосы: цифры опыта переехали сюда из шапки. */
  label?: string;
}) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(Math.max(0, Math.min(1, ratio)), { duration: 450 });
  }, [ratio, width]);

  const fill = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));

  return (
    <View style={styles.barTrack}>
      <Animated.View style={[styles.barFill, fill]}>
        {/* Диагональная штриховка под 115° — прямая цитата из полосы
            прогресса Windows Vista, и в макете она названа поимённо. */}
        <View style={styles.hatchRow}>
          {Array.from({ length: 40 }).map((_, index) => (
            <View key={index} style={styles.hatch} />
          ))}
        </View>
        <Gloss radius={radii.pill} />
      </Animated.View>

      {label != null && <Text style={styles.barLabel}>{label}</Text>}
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
      <Gloss radius={radii.pill} />
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
      {({ pressed }) => (
        <>
          {/* Нажатие — инверсия света, без сдвига по Y: так в макете. */}
          <Gloss radius={radii.pill} pressed={pressed} />
          <Text style={[styles.buttonText, tone === 'ghost' && styles.buttonTextGhost]}>
            {label}
          </Text>
        </>
      )}
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
    borderWidth: line,
    borderColor: palette.edge,
    backgroundColor: palette.sand,
    overflow: 'hidden',
    ...shadow,
    shadowOpacity: 0.12,
  },
  // Подпись лежит поверх полосы по центру: отдельная строка под ней
  // съела бы место у карты, ради которого шапку и ужимали.
  barLabel: {
    position: 'absolute',
    alignSelf: 'center',
    top: 4,
    color: palette.textDark,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.mono,
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  barFill: {
    height: '100%',
    backgroundColor: palette.ember,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  hatchRow: { flexDirection: 'row', gap: 10, paddingLeft: 4 },
  hatch: {
    width: 5,
    height: 70,
    backgroundColor: palette.emberDeep,
    opacity: 0.45,
    transform: [{ rotate: '115deg' }],
  },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: line,
    borderColor: palette.edge,
    backgroundColor: palette.parchmentBright,
    overflow: 'hidden',
    ...shadow,
  },
  chipText: { color: palette.textDark, fontFamily: fonts.display, fontWeight: '800', letterSpacing: 1 },

  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: line,
    borderColor: palette.edge,
    backgroundColor: palette.parchmentBright,
    ...shadow,
  },
  toastIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.sm,
    borderWidth: line,
    borderColor: palette.edgeSoft,
    backgroundColor: palette.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastIconText: { fontSize: 20 },
  toastBody: { flex: 1 },
  toastTitle: { color: palette.textDark, fontFamily: fonts.display, fontWeight: '900', fontSize: 16 },
  toastSubtitle: { color: palette.textMuted, marginTop: 2, fontVariant: ['tabular-nums'] },
  toastClose: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    borderWidth: line,
    borderColor: palette.edgeSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastCloseText: { color: palette.textDark, fontFamily: fonts.display, fontWeight: '900' },

  button: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    borderWidth: line,
    borderColor: palette.edge,
    backgroundColor: palette.ember,
    alignItems: 'center',
    overflow: 'hidden',
    ...shadow,
  },
  buttonGhost: { backgroundColor: palette.parchmentBright },
  // Само нажатие рисует Gloss: тень уезжает внутрь, свет переворачивается.
  // Стекло при этом остаётся на месте — оно не ездит.
  buttonPressed: { shadowOpacity: 0.08, elevation: 1 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: palette.textOnDark, fontFamily: fonts.display, fontWeight: '900', letterSpacing: 1 },
  buttonTextGhost: { color: palette.textDark },

  stat: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: line,
    borderColor: palette.edge,
    backgroundColor: palette.parchmentBright,
    ...shadow,
  },
  statValue: {
    color: palette.textDark,
    fontSize: 22,
    fontFamily: fonts.display,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  statLabel: { color: palette.textMuted, marginTop: 2, fontSize: 12, letterSpacing: 1 },
});
