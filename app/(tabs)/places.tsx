import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { allPlaces, getProfile } from '@/core/db/repo';
import { haversineMeters } from '@/core/geo/mercator';
import { fonts, palette, radii, spacing } from '@/core/theme/tokens';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { useWalkStore } from '@/store/useWalkStore';

/** Цвет плитки закреплён за типом места — как в макете. */
const KINDS: Record<
  string,
  { icon: keyof typeof Feather.glyphMap; color: string; label: string }
> = {
  cafe: { icon: 'coffee', color: palette.ember, label: 'Кафе' },
  park: { icon: 'sun', color: palette.teal, label: 'Парк' },
  viewpoint: { icon: 'eye', color: palette.rust, label: 'Достопримечательность' },
};

const FALLBACK_KIND = { icon: 'map-pin', color: palette.mulberry, label: 'Место' } as const;

/** Метры до места: близкие — в метрах, дальние — в километрах. */
function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} м`;
  return `${(meters / 1000).toFixed(1)} км`;
}

export default function PlacesScreen() {
  const insets = useSafeAreaInsets();
  const exploredCells = useWalkStore((s) => s.exploredCells);
  const places = useMemo(() => allPlaces(), [exploredCells]);

  // Расстояние считаем от домашней точки: живой геолокации на этом экране
  // нет, а гонять её ради списка — лишний расход батареи.
  const profile = getProfile();
  const origin =
    profile.originLat != null && profile.originLng != null
      ? { lat: profile.originLat, lng: profile.originLng }
      : null;

  const found = places.filter((p) => p.discoveredAt != null).length;
  const hidden = places.length - found;

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Места рядом"
        subtitle={`${found} найдено · ${hidden} скрыто туманом`}
        topInset={insets.top}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {places.map((place) => {
          const discovered = place.discoveredAt != null;
          const kind = KINDS[place.type] ?? FALLBACK_KIND;
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
