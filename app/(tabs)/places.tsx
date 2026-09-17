import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { allPlaces } from '@/core/db/repo';
import { palette, radii, spacing } from '@/core/theme/tokens';
import { useWalkStore } from '@/store/useWalkStore';

const ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  cafe: 'coffee',
  park: 'sun',
  viewpoint: 'eye',
};

export default function PlacesScreen() {
  const insets = useSafeAreaInsets();
  const exploredCells = useWalkStore((s) => s.exploredCells);
  const places = useMemo(() => allPlaces(), [exploredCells]);

  const found = places.filter((p) => p.discoveredAt != null).length;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
    >
      <Text style={styles.heading}>МЕСТА</Text>
      <Text style={styles.counter}>
        Найдено {found} из {places.length}
      </Text>

      {places.map((place) => {
        const discovered = place.discoveredAt != null;
        return (
          <View key={place.id} style={styles.card}>
            <View style={[styles.icon, !discovered && styles.iconLocked]}>
              <Feather
                name={discovered ? (ICONS[place.type] ?? 'map-pin') : 'help-circle'}
                size={20}
                color={palette.textDark}
              />
            </View>
            <View style={styles.body}>
              {/*
                Неоткрытые места намеренно скрывают название: смысл механики
                в том, чтобы дойти и узнать, а не прочитать список заранее.
              */}
              <Text style={styles.title}>{discovered ? place.title : '???'}</Text>
              <Text style={styles.subtitle}>
                {discovered ? (place.subtitle ?? 'Найдено') : `Где-то рядом · +${place.xpReward} XP`}
              </Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.dune },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  heading: { color: palette.textOnDark, fontSize: 24, fontWeight: '900', letterSpacing: 2 },
  counter: { color: palette.parchment, marginBottom: spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 3,
    borderColor: palette.ink,
    backgroundColor: palette.parchment,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    borderWidth: 3,
    borderColor: palette.ink,
    backgroundColor: palette.parchmentBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLocked: { backgroundColor: palette.sand },
  body: { flex: 1 },
  title: { color: palette.textDark, fontWeight: '900', fontSize: 16 },
  subtitle: { color: palette.textMuted, marginTop: 2 },
});
