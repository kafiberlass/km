/**
 * Строка состояния вместо кнопки «начать прогулку».
 *
 * Кнопки больше нет: приложение само решает, когда человек пошёл
 * (см. autoWalk.ts и useWalkStore.observe). Но молчащий интерфейс в такой
 * схеме хуже кнопки — человек должен видеть, что приложение его слышит:
 * ждёт, пишет или не может, потому что ему не дали доступ.
 */

import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { palette, radii, spacing } from '@/core/theme/tokens';
import { useWalkStore } from '@/store/useWalkStore';

import { BackgroundNote } from './BackgroundNote';

export function WalkStatus() {
  const status = useWalkStore((s) => s.status);
  const distanceM = useWalkStore((s) => s.distanceM);
  const permission = useWalkStore((s) => s.permission);

  const tracking = status === 'tracking' || status === 'starting';

  if (permission === 'denied') {
    return (
      <Pressable
        onPress={() => void Linking.openSettings()}
        style={({ pressed }) => [styles.pill, styles.denied, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Открыть настройки геопозиции"
      >
        <Feather name="alert-triangle" size={16} color={palette.textOnDark} />
        <Text style={styles.deniedText}>НЕТ ДОСТУПА К ГЕОПОЗИЦИИ — ВКЛЮЧИТЬ</Text>
      </Pressable>
    );
  }

  if (tracking) {
    return (
      <View style={styles.wrap}>
        <View style={[styles.pill, styles.active]}>
          <View style={styles.dot} />
          <Text style={styles.activeText}>ИДУ · {(distanceM / 1000).toFixed(2)} КМ</Text>
        </View>
        <BackgroundNote />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.pill}>
        <Feather name="clock" size={16} color={palette.textMuted} />
        <Text style={styles.idleText}>ЖДУ ПРОГУЛКУ</Text>
      </View>
      <Text style={styles.hint}>запись включится сама, когда вы пойдёте</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.xs },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    borderWidth: 3,
    borderColor: palette.ink,
    backgroundColor: palette.sand,
  },
  active: { backgroundColor: palette.ember },
  denied: { backgroundColor: palette.rust },
  pressed: { transform: [{ translateY: 2 }] },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.textOnDark,
  },
  activeText: {
    color: palette.textOnDark,
    fontWeight: '900',
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  idleText: { color: palette.textMuted, fontWeight: '900', letterSpacing: 1 },
  deniedText: { color: palette.textOnDark, fontWeight: '900', letterSpacing: 1, fontSize: 12 },
  hint: { color: palette.parchment, fontSize: 12, opacity: 0.8 },
});
