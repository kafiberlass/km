/**
 * Экран вместо вылета.
 *
 * Когда что-то ломается, приложение либо закрывается молча, либо
 * показывает пустоту — и человеку на другом конце города нечего сказать,
 * кроме «оно не работает». Здесь оно говорит, что именно сломалось, и
 * даёт кнопку переслать это разработчику.
 */

import React from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { fonts, line, palette, radii, spacing, text } from '@/core/theme/tokens';
import { ActionButton } from '@/ui/widgets';

interface Props {
  text: string;
  onRetry?: () => void;
}

export function CrashScreen({ text, onRetry }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.lg }]}>
      <View style={styles.badge}>
        <Feather name="alert-triangle" size={28} color={palette.textOnDark} />
      </View>

      <Text style={styles.title}>Приложение споткнулось</Text>
      <Text style={styles.body}>
        Данные целы — прогулки и карта на месте. Ниже написано, что именно сломалось.
        Отправьте этот текст разработчику, и поломку починят.
      </Text>

      <ScrollView style={styles.box} contentContainerStyle={styles.boxContent}>
        <Text style={styles.mono} selectable>
          {text}
        </Text>
      </ScrollView>

      <ActionButton
        label="ОТПРАВИТЬ РАЗРАБОТЧИКУ"
        onPress={() => void Share.share({ message: `КМ, поломка:\n\n${text}` })}
      />

      {onRetry && <ActionButton label="ПОПРОБОВАТЬ СНОВА" tone="ghost" onPress={onRetry} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.dune, padding: spacing.lg, gap: spacing.md },
  badge: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    borderWidth: line,
    borderColor: palette.edgeSoft,
    backgroundColor: palette.rust,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: palette.textDark, fontFamily: fonts.display, fontWeight: '900', fontSize: text.screen },
  body: { color: palette.textMuted, fontFamily: fonts.body, fontSize: text.body },
  box: {
    maxHeight: 260,
    borderRadius: radii.md,
    borderWidth: line,
    borderColor: palette.edgeSoft,
    backgroundColor: palette.parchmentBright,
  },
  boxContent: { padding: spacing.md },
  mono: { color: palette.textDark, fontFamily: fonts.mono, fontSize: text.body },
});
