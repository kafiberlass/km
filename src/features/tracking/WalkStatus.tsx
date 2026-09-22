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

import { formatSteps, stepsFromMeters } from '@/core/rules/steps';
import { fonts, line, palette, pressStyle, radii, shadow, spacing, text } from '@/core/theme/tokens';
import { useAlwaysSharing } from '@/features/friends';
import { useWalkStore } from '@/store/useWalkStore';

import { BackgroundNote } from './BackgroundNote';

export function WalkStatus() {
  const status = useWalkStore((s) => s.status);
  const distanceM = useWalkStore((s) => s.distanceM);
  const permission = useWalkStore((s) => s.permission);
  const sharing = useAlwaysSharing();

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
        {/* Шаги отдельной строкой, а не в таблетке: длинную строку
            она переносит, и получается два этажа текста в овале. */}
        <Text style={styles.hint}>≈ {formatSteps(stepsFromMeters(distanceM))} шагов</Text>
        <BackgroundNote />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.pill}>
        <Feather name="clock" size={16} color={palette.textMuted} />
        <Text style={styles.idleText}>ЖДУ ПРОГУЛКУ</Text>

        {/* Трансляция должна быть видна всегда, а не только на экране,
            где её включили: человек имеет право знать, что его видно. */}
        {sharing && (
          <>
            <View style={styles.divider} />
            <Feather name="radio" size={16} color={palette.emberDeep} />
            <Text style={styles.sharingText}>ВИДЕН ДРУЗЬЯМ</Text>
          </>
        )}
      </View>
      <View style={styles.hintWrap}>
        <Text style={styles.hint}>запись включится сама, когда вы пойдёте</Text>
      </View>
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
    borderWidth: line,
    borderColor: palette.edgeSoft,
    backgroundColor: palette.parchmentBright,
    ...shadow,
  },
  active: { backgroundColor: palette.ember },
  denied: { backgroundColor: palette.rust },
  pressed: { ...pressStyle },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.textOnDark,
  },
  activeText: {
    color: palette.textOnLime,
    fontFamily: fonts.display,
    fontWeight: '900',
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  idleText: { color: palette.textDark, fontFamily: fonts.display, fontWeight: '900', letterSpacing: 1 },
  divider: { width: 1, height: 16, backgroundColor: palette.textMuted, opacity: 0.4 },
  sharingText: { color: palette.emberDeep, fontFamily: fonts.display, fontWeight: '900', letterSpacing: 1, fontSize: text.meta },
  deniedText: { color: palette.textOnDark, fontFamily: fonts.display, fontWeight: '900', letterSpacing: 1, fontSize: text.meta },
  // Стекло под подсказкой: под ней бывает и светлая земля, и тёмный
  // туман, и на одном из двух текст пропадал целиком.
  hintWrap: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: palette.glass,
  },
  hint: {
    fontFamily: fonts.body,
    color: palette.textDark,
    fontSize: text.meta,
  },
});
