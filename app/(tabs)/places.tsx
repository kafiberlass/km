import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { allPlaces } from '@/core/db/repo';
import { palette, spacing } from '@/core/theme/tokens';
import { Glass, Orb, SkyBackdrop, type GlassTone } from '@/ui/aero';
import { ScreenHeader } from '@/ui/headers';
import { useWalkStore } from '@/store/useWalkStore';

const ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  cafe: 'coffee',
  park: 'sun',
  viewpoint: 'eye',
};

/** Цвет капли под тип места: кофе — золото, парк — лайм, вид — аква. */
const ORB_TONE: Record<string, GlassTone> = {
  cafe: 'gold',
  park: 'lime',
  viewpoint: 'aqua',
};

export default function PlacesScreen() {
  const insets = useSafeAreaInsets();
  const exploredCells = useWalkStore((s) => s.exploredCells);
  const places = useMemo(() => allPlaces(), [exploredCells]);

  const found = places.filter((p) => p.discoveredAt != null).length;

  return (
    <View style={styles.root}>
      <SkyBackdrop />

      <View style={{ paddingTop: insets.top }}>
        <ScreenHeader
          title="МЕСТА"
          subtitle={`Найдено ${found} из ${places.length}`}
          right={
            <Orb size={54} tone="aqua">
              <Feather name="compass" size={26} color="#04405F" />
            </Orb>
          }
        />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {places.map((place) => {
          const discovered = place.discoveredAt != null;
          return (
            <Glass key={place.id} tone={discovered ? 'light' : 'dark'}>
              <View style={styles.card}>
                <Orb size={48} tone={discovered ? (ORB_TONE[place.type] ?? 'aqua') : 'dark'}>
                  <Feather
                    name={discovered ? (ICONS[place.type] ?? 'map-pin') : 'help-circle'}
                    size={23}
                    color={discovered ? palette.textOnGlass : palette.textOnDark}
                  />
                </Orb>

                <View style={styles.body}>
                  {/*
                    Неоткрытые места намеренно скрывают название: смысл механики
                    в том, чтобы дойти и узнать, а не прочитать список заранее.
                  */}
                  <Text style={[styles.title, !discovered && styles.titleLocked]}>
                    {discovered ? place.title : '???'}
                  </Text>
                  <Text style={[styles.subtitle, !discovered && styles.subtitleLocked]}>
                    {discovered ? (place.subtitle ?? 'Найдено') : 'Где-то рядом'}
                  </Text>
                </View>

                <View style={styles.tail}>
                  {discovered && <Feather name="check" size={18} color={palette.limeShadow} />}
                  <Text style={[styles.reward, !discovered && styles.rewardLocked]}>
                    +{place.xpReward} XP
                  </Text>
                </View>
              </View>
            </Glass>
          );
        })}

        <Text style={styles.note}>
          Название открывается, только когда вы дошли: смысл в том, чтобы дойти и
          узнать, а не прочитать список заранее.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.skyMid },
  content: { padding: spacing.md, gap: 10, paddingBottom: spacing.xxl },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  body: { flex: 1 },
  title: { color: palette.textOnGlass, fontWeight: '900', fontSize: 16.5 },
  titleLocked: { color: palette.textOnDark, letterSpacing: 2 },
  subtitle: { color: palette.textMuted, marginTop: 2, fontSize: 13 },
  subtitleLocked: { color: palette.textOnDarkMuted },
  tail: { alignItems: 'flex-end', gap: 3 },
  reward: {
    color: palette.textMuted,
    fontWeight: '800',
    fontSize: 12.5,
    fontVariant: ['tabular-nums'],
  },
  rewardLocked: { color: palette.textOnDarkMuted },
  note: {
    color: palette.textOnGlass,
    fontSize: 12.5,
    lineHeight: 18,
    padding: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.glassEdge,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
});
