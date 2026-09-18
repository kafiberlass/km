/**
 * Строчка про фоновую запись под кнопкой прогулки.
 *
 * Нужна, потому что разница между «При использовании» и «Всегда» невидима,
 * а последствия — нет: в первом случае телефон в кармане означает пустую
 * карту за весь путь. Человек должен узнать об этом до прогулки, а не после.
 */

import React from 'react';
import { Linking, Pressable, StyleSheet, Text } from 'react-native';

import { fonts, palette } from '@/core/theme/tokens';
import { useWalkStore } from '@/store/useWalkStore';

export function BackgroundNote() {
  const status = useWalkStore((s) => s.status);
  const background = useWalkStore((s) => s.background);
  const permission = useWalkStore((s) => s.permission);

  if (status !== 'tracking' && status !== 'starting') return null;

  if (background) {
    return <Text style={styles.ok}>запись идёт в фоне — телефон можно убрать</Text>;
  }

  // Разрешение «Всегда» iOS не отдаёт по первой просьбе: сначала «При
  // использовании», и только потом, поработав, приложение может попросить
  // ещё раз. Поэтому ведём в настройки, а не показываем диалог снова.
  return (
    <Pressable
      onPress={() => void Linking.openSettings()}
      accessibilityRole="button"
      accessibilityLabel="Открыть настройки геопозиции"
    >
      <Text style={styles.warn}>
        {permission === 'when-in-use'
          ? 'фон выключен: свернёте — запись прервётся. Включить «Всегда» →'
          : 'фон недоступен: проверьте доступ к геопозиции →'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ok: {
    fontFamily: fonts.body, color: palette.parchment, fontSize: 12, textAlign: 'center', opacity: 0.8 },
  warn: { color: palette.gold, fontSize: 12, textAlign: 'center', fontFamily: fonts.display, fontWeight: '700' },
});
