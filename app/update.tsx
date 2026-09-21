/**
 * Обновление приложения.
 *
 * Обычно этот экран не нужен: приложение проверяет обновления само при
 * каждом запуске и применяет их к следующему. Экран существует для двух
 * случаев — «хочу прямо сейчас» и «что-то сломалось, дай проверю».
 */

import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

import { fonts, line, palette, radii, spacing } from '@/core/theme/tokens';
import {
  applyUpdate,
  currentUpdateLabel,
  fetchUpdate,
  updateMessage,
  updatesSupported,
  type UpdateResult,
} from '@/features/updates/ota';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { ActionButton } from '@/ui/widgets';

export default function UpdateScreen() {
  const insets = useSafeAreaInsets();

  const [supported] = useState(() => updatesSupported());
  const [current] = useState(() => currentUpdateLabel());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UpdateResult | null>(null);

  const check = useCallback(async () => {
    setBusy(true);
    setResult(null);
    setResult(await fetchUpdate());
    setBusy(false);
  }, []);

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Обновление"
        subtitle="Новые версии приезжают сами"
        topInset={insets.top}
        onClose={() => router.back()}
      />

      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>СЕЙЧАС УСТАНОВЛЕНО</Text>
          <Text style={styles.body}>{current}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>ПРОВЕРИТЬ</Text>
          <Text style={styles.body}>
            Приложение и так проверяет обновления при каждом запуске и ставит их само.
            Эта кнопка — если ждать следующего запуска не хочется.
          </Text>

          <ActionButton
            label={busy ? 'ПРОВЕРЯЮ…' : 'ПРОВЕРИТЬ ОБНОВЛЕНИЯ'}
            onPress={() => void check()}
            disabled={busy || !supported}
          />

          {result === 'ready' && (
            <ActionButton
              label="ПЕРЕЗАПУСТИТЬ И ОБНОВИТЬСЯ"
              tone="primary"
              onPress={() => void applyUpdate()}
            />
          )}
        </View>

        {busy && <ActivityIndicator color={palette.ember} />}

        {result != null && (
          <View style={styles.message}>
            <Feather
              name={result === 'ready' || result === 'none' ? 'check-circle' : 'alert-triangle'}
              size={16}
              color={result === 'ready' || result === 'none' ? palette.teal : palette.rust}
            />
            <Text style={result === 'ready' || result === 'none' ? styles.ok : styles.error}>
              {updateMessage(result)}
            </Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>ЧЕГО ТАК НЕ ОБНОВИТЬ</Text>
          <Text style={styles.body}>
            По воздуху приезжает всё, что написано кодом: карта, туман, места, друзья.
            Не приезжает нативная часть — новые разрешения телефона или новые
            возможности системы. Когда меняется она, нужен новый файл приложения,
            и об этом скажут отдельно.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.dune },
  content: { padding: spacing.lg, gap: spacing.md },
  card: {
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: line,
    borderColor: palette.edgeSoft,
    backgroundColor: palette.parchment,
    gap: spacing.sm,
  },
  cardTitle: {
    color: palette.textMuted,
    fontFamily: fonts.display,
    fontWeight: '900',
    letterSpacing: 1,
    fontSize: 12,
  },
  body: { color: palette.textDark, fontFamily: fonts.body, fontSize: 13 },
  message: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ok: { color: palette.teal, fontFamily: fonts.display, fontWeight: '700', flex: 1 },
  error: { color: palette.rust, fontFamily: fonts.display, fontWeight: '700', flex: 1 },
});
