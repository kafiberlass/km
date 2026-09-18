import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { allPlaces, getProfile, removeDemoPlaces, upsertPlaces } from '@/core/db/repo';
import { haversineMeters } from '@/core/geo/mercator';
import { fonts, palette, radii, spacing } from '@/core/theme/tokens';
import { placeKind } from '@/features/places/kinds';
import { fetchNearbyPlaces } from '@/features/places/nearby';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { ActionButton } from '@/ui/widgets';
import { useWalkStore } from '@/store/useWalkStore';

/** Цвет плитки закреплён за типом места — как в макете. */
/** Метры до места: близкие — в метрах, дальние — в километрах. */
function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} м`;
  return `${(meters / 1000).toFixed(1)} км`;
}

export default function PlacesScreen() {
  const insets = useSafeAreaInsets();
  const exploredCells = useWalkStore((s) => s.exploredCells);
  const placesVersion = useWalkStore((s) => s.placesVersion);
  const refreshPlaces = useWalkStore((s) => s.refreshPlaces);

  // version растёт после загрузки мест: список читается из базы, и без него
  // экран покажет старое содержимое, пока не перерисуется по другому поводу.
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const places = useMemo(() => allPlaces(), [exploredCells, version, placesVersion]);

  // Расстояние считаем от домашней точки: живой геолокации на этом экране
  // нет, а гонять её ради списка — лишний расход батареи.
  const profile = getProfile();
  const origin =
    profile.originLat != null && profile.originLng != null
      ? { lat: profile.originLat, lng: profile.originLng }
      : null;

  const found = places.filter((p) => p.discoveredAt != null).length;
  const hidden = places.length - found;

  const search = useCallback(async () => {
    if (!origin || busy) return;

    setBusy(true);
    setMessage(null);

    const result = await fetchNearbyPlaces(origin);

    if (result.status === 'ok') {
      upsertPlaces(result.places);
      // Демо-места из Москвы больше не нужны — они и не были нужны никому,
      // кроме демо-трека.
      removeDemoPlaces();
      setVersion((value) => value + 1);
      // Движок держит неоткрытые места в памяти: без этого новые не начнут
      // открываться до перезапуска приложения.
      refreshPlaces();
      setMessage(`Нашёл ${result.places.length} мест в трёх километрах вокруг`);
    } else if (result.status === 'empty') {
      setMessage('Вокруг ничего не нашлось — редкий случай, но бывает за городом');
    } else if (result.status === 'busy') {
      setMessage('Сервер карт сейчас занят. Попробуйте через пару минут');
    } else if (result.status === 'offline') {
      setMessage('Нет связи — места ищутся только с интернетом, зато потом работают без него');
    } else {
      setMessage('Не получилось загрузить места');
    }

    setBusy(false);
  }, [busy, origin?.lat, origin?.lng, refreshPlaces]);

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Места рядом"
        subtitle={`${found} найдено · ${hidden} скрыто туманом`}
        topInset={insets.top}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.search}>
          <ActionButton
            label={busy ? 'ИЩУ…' : 'НАЙТИ МЕСТА РЯДОМ'}
            onPress={() => void search()}
            disabled={busy || origin == null}
            tone="primary"
          />
          <Text style={styles.searchHint}>
            {origin == null
              ? 'Сначала нужна первая прогулка: без неё приложение не знает, где искать.'
              : 'Парки, кафе и достопримечательности из OpenStreetMap в трёх километрах вокруг дома. Загружаются один раз и дальше работают без интернета.'}
          </Text>
          {message != null && <Text style={styles.searchMessage}>{message}</Text>}
        </View>

        {places.map((place) => {
          const discovered = place.discoveredAt != null;
          const kind = placeKind(place.type);
          const distance =
            origin != null
              ? formatDistance(haversineMeters(origin, { lat: place.lat, lng: place.lng }))
              : null;

          if (!discovered) {
            /*
              Неоткрытые места намеренно скрывают название: смысл механики
              в том, чтобы дойти и узнать, а не прочитать список заранее.
              В макете у них пунктирная рамка — «здесь что-то есть».
            */
            return (
              <View key={place.id} style={[styles.card, styles.cardHidden]}>
                <View style={[styles.badge, styles.badgeHidden]}>
                  <Feather name="lock" size={20} color={palette.textMuted} />
                </View>
                <View style={styles.body}>
                  <Text style={styles.titleHidden}>??? Скрыто туманом</Text>
                  <Text style={styles.subtitle}>
                    ПРОЙДИ РЯДОМ, ЧТОБЫ ОТКРЫТЬ · +{place.xpReward} XP
                  </Text>
                </View>
              </View>
            );
          }

          return (
            <View key={place.id} style={styles.card}>
              <View style={[styles.badge, { backgroundColor: kind.color }]}>
                <Feather name={kind.icon} size={20} color={palette.parchmentBright} />
              </View>
              <View style={styles.body}>
                <Text style={styles.title} numberOfLines={1}>
                  {place.title.toUpperCase()}
                </Text>
                <Text style={styles.subtitle}>
                  {[kind.label, distance, place.subtitle]
                    .filter((part) => part != null && part !== '')
                    .join(' · ')
                    .toUpperCase()}
                </Text>
              </View>
              <Feather name="chevron-right" size={22} color={palette.textDark} />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  search: { gap: spacing.sm, marginBottom: spacing.sm },
  searchHint: { color: palette.textMuted, fontSize: 12, fontFamily: fonts.body },
  searchMessage: {
    color: palette.textDark,
    fontSize: 13,
    fontFamily: fonts.display,
    fontWeight: '700',
  },
  root: { flex: 1, backgroundColor: palette.dune },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 3,
    borderColor: palette.ink,
    backgroundColor: palette.parchmentBright,
  },
  cardHidden: {
    backgroundColor: palette.sand,
    borderStyle: 'dashed',
    borderColor: palette.textMuted,
  },
  badge: {
    width: 46,
    height: 46,
    borderRadius: radii.md,
    borderWidth: 3,
    borderColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeHidden: { backgroundColor: '#B6A883', borderColor: palette.textMuted },
  body: { flex: 1, gap: 2 },
  title: { color: palette.textDark, fontFamily: fonts.display, fontWeight: '900', fontSize: 16, letterSpacing: 0.5 },
  titleHidden: { color: palette.textMuted, fontFamily: fonts.display, fontWeight: '900', fontSize: 16 },
  subtitle: {
    fontFamily: fonts.body,
    color: palette.textMuted,
    fontSize: 11,
    letterSpacing: 0.8,
    fontVariant: ['tabular-nums'],
  },
});
