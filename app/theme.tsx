/**
 * Выбор оформления.
 *
 * Тем две, и они не про «светлее — темнее», а про два разных настроения:
 * вода со стеклом и земля с бумагой. Второе — то оформление, с которым
 * приложение начиналось; оно никуда не делось, а стало ночным.
 *
 * Смена требует перезапуска: стили в React Native собираются в момент
 * загрузки файла. Так же устроена смена языка в системных настройках —
 * это нормальная цена, а не поломка.
 */

import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

import {
  readChoice,
  writeChoice,
  type ThemeChoice,
} from '@/core/theme/choice';
import { fonts, line, palette, radii, shadow, spacing, themeName } from '@/core/theme/tokens';
import { restartApp } from '@/features/updates/ota';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { ActionButton } from '@/ui/widgets';

const OPTIONS: readonly { value: ThemeChoice; title: string; hint: string; colors: string[] }[] = [
  {
    value: 'aqua',
    title: 'Аква',
    hint: 'Вода, стекло и блики. Светлая.',
    colors: ['#35A9E8', '#66D3FA', '#FFFFFF'],
  },
  {
    value: 'dusk',
    title: 'Сумерки',
    hint: 'Земля, пергамент и чернила. Тёмная карта, как было раньше.',
    colors: ['#2E1F17', '#E4713F', '#E5D6B7'],
  },
  {
    value: 'system',
    title: 'Как в телефоне',
    hint: 'Днём аква, ночью сумерки — следом за настройками системы.',
    colors: ['#66D3FA', '#6B5544', '#E9A83C'],
  },
];

export default function ThemeScreen() {
  const insets = useSafeAreaInsets();
  const [choice, setChoice] = useState<ThemeChoice>(() => readChoice());

  const pick = (next: ThemeChoice) => {
    setChoice(next);
    writeChoice(next);
  };

  const restart = async () => {
    const ok = await restartApp();
    if (!ok) {
      Alert.alert(
        'Закройте и откройте приложение',
        'Перезапустить себя приложение сейчас не может — так бывает в сборках для разработки. Закройте его полностью и откройте снова: тема применится.',
      );
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Оформление"
        subtitle={themeName === 'dusk' ? 'Сейчас: сумерки' : 'Сейчас: аква'}
        topInset={insets.top}
        onClose={() => router.back()}
      />

      <View style={styles.content}>
        {OPTIONS.map((option) => {
          const active = choice === option.value;

          return (
            <Pressable
              key={option.value}
              onPress={() => pick(option.value)}
              style={[styles.card, active && styles.cardActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <View style={styles.swatches}>
                {option.colors.map((color) => (
                  <View key={color} style={[styles.swatch, { backgroundColor: color }]} />
                ))}
              </View>

              <View style={styles.body}>
                <Text style={styles.title}>{option.title}</Text>
                <Text style={styles.hint}>{option.hint}</Text>
              </View>

              <Feather
                name={active ? 'check-circle' : 'circle'}
                size={22}
                color={active ? palette.ember : palette.textMuted}
              />
            </Pressable>
          );
        })}

        <Text style={styles.note}>
          Тема применяется после перезапуска: оформление собирается один раз при
          запуске приложения и на лету не меняется.
        </Text>

        <ActionButton label="ПЕРЕЗАПУСТИТЬ СЕЙЧАС" onPress={() => void restart()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.dune },
  content: { padding: spacing.lg, gap: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: line,
    borderColor: palette.edge,
    backgroundColor: palette.parchment,
    ...shadow,
  },
  cardActive: { backgroundColor: palette.parchmentBright, borderColor: palette.ember },
  swatches: { flexDirection: 'row' },
  swatch: {
    width: 18,
    height: 36,
    borderWidth: line,
    borderColor: palette.edgeSoft,
    marginRight: -6,
    borderRadius: 4,
  },
  body: { flex: 1, gap: 2 },
  title: { color: palette.textDark, fontFamily: fonts.display, fontWeight: '900', fontSize: 16 },
  hint: { color: palette.textMuted, fontFamily: fonts.body, fontSize: 12 },
  note: { color: palette.textMuted, fontFamily: fonts.body, fontSize: 12 },
});
