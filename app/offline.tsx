/**
 * Карта на телефон.
 *
 * Тайлы карты тянутся из сети. В парке сети может не быть, в поездке
 * она стоит денег, а прогулка — это ровно то время, когда человек далеко
 * от вайфая. Скачанная область снимает вопрос: карта рисуется из памяти
 * телефона, приложению интернет больше не нужен вовсе.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

import { getProfile } from '@/core/db/repo';
import { fonts, palette, radii, spacing } from '@/core/theme/tokens';
import { formatSize } from '@/features/map/offlineArea';
import {
  currentPackProgress,
  deleteArea,
  downloadArea,
  planArea,
  type OfflineProgress,
} from '@/features/map/offlinePacks';
import { DEMO_CENTER } from '@/features/places/seed';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { ActionButton } from '@/ui/widgets';

/** Радиусы на выбор: свой район, весь город, город с окрестностями. */
const RADII = [3, 7, 15] as const;

export default function OfflineScreen() {
  const insets = useSafeAreaInsets();

  const profile = getProfile();
  const center =
    profile.originLat != null && profile.originLng != null
      ? { lat: profile.originLat, lng: profile.originLng }
      : { lat: DEMO_CENTER[1], lng: DEMO_CENTER[0] };

  const [radiusKm, setRadiusKm] = useState<number>(RADII[1]);
  const [progress, setProgress] = useState<OfflineProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plan = planArea(center, radiusKm);

  useEffect(() => {
    void currentPackProgress().then(setProgress);
  }, []);

  const download = useCallback(async () => {
    setBusy(true);
    setError(null);
    setProgress(null);

    try {
      await downloadArea(
        center,
        radiusKm,
        (next) => {
          setProgress(next);
          if (next.done) setBusy(false);
        },
        (message) => {
          setError(message);
          setBusy(false);
        },
      );
    } catch (failure) {
      console.warn('[offline] скачать не удалось', failure);
      setError('Не получилось начать загрузку');
      setBusy(false);
    }
  }, [center.lat, center.lng, radiusKm]);

  const remove = useCallback(async () => {
    setBusy(true);
    await deleteArea();
    setProgress(null);
    setBusy(false);
  }, []);

  const saved = progress != null && progress.completedTiles > 0;

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Карта офлайн"
        subtitle="Чтобы гулять без интернета"
        topInset={insets.top}
        onClose={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>СКОЛЬКО ВОКРУГ ДОМА</Text>

          <View style={styles.radii}>
            {RADII.map((value) => (
              <Pressable
                key={value}
                onPress={() => setRadiusKm(value)}
                disabled={busy}
                style={({ pressed }) => [
                  styles.radius,
                  value === radiusKm && styles.radiusChosen,
                  pressed && styles.radiusPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${value} километров вокруг дома`}
              >
                <Text style={[styles.radiusValue, value === radiusKm && styles.radiusValueChosen]}>
                  {value} км
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.body}>
            Примерно {formatSize(plan.bytes)} · {plan.tiles} кусочков карты. Точный объём
            зависит от того, насколько плотно застроен район.
          </Text>
        </View>

        {progress != null && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {progress.done ? 'СКАЧАНО' : `ЗАГРУЗКА ${Math.round(progress.percentage)}%`}
            </Text>

            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.max(2, progress.percentage)}%` }]} />
            </View>

            <Text style={styles.body}>
              {progress.completedTiles} кусочков · {formatSize(progress.completedBytes)}
            </Text>
          </View>
        )}

        {error != null && (
          <View style={styles.errorBox}>
            <Feather name="alert-triangle" size={16} color={palette.rust} />
            <Text style={styles.error}>{error}</Text>
          </View>
        )}

        <ActionButton
          label={busy ? 'КАЧАЮ…' : saved ? 'СКАЧАТЬ ЗАНОВО' : 'СКАЧАТЬ КАРТУ'}
          onPress={() => void download()}
          disabled={busy}
        />

        {saved && (
          <ActionButton
            label="УДАЛИТЬ СКАЧАННОЕ"
            tone="ghost"
            onPress={() => void remove()}
            disabled={busy}
          />
        )}

        <Text style={styles.note}>
          Качать лучше по вайфаю: это единственный раз, когда приложению нужен интернет
          по-крупному. Дальше карта берётся из памяти телефона — и дома, и в лесу,
          и в самолёте.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.dune },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },

  card: {
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
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

  radii: { flexDirection: 'row', gap: spacing.sm },
  radius: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.edgeSoft,
    backgroundColor: palette.sand,
    alignItems: 'center',
  },
  radiusChosen: { backgroundColor: palette.ember },
  radiusPressed: { transform: [{ translateY: 2 }] },
  radiusValue: {
    color: palette.textDark,
    fontFamily: fonts.display,
    fontWeight: '900',
    letterSpacing: 1,
  },
  radiusValueChosen: { color: palette.textOnDark },

  track: {
    height: 18,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: palette.edgeSoft,
    backgroundColor: palette.parchmentBright,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: palette.ember },

  errorBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  error: { color: palette.rust, fontFamily: fonts.display, fontWeight: '700', flex: 1 },

  note: { color: palette.textMuted, fontFamily: fonts.body, fontSize: 12 },
});
