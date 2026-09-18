/**
 * История прогулок.
 *
 * Данные копились с первого дня, но показать их было негде: человек видел
 * только текущую прогулку и общий счётчик километров. Здесь — каждая
 * прогулка по дням и три итога: неделя, месяц, всё время.
 */

import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

import { getProfile, listWalks } from '@/core/db/repo';
import { deviceTimeZone } from '@/core/rules/streak';
import {
  formatDistance,
  formatDuration,
  groupByDay,
  totalsOf,
  totalsSince,
} from '@/core/walk/history';
import { fonts, palette, radii, spacing } from '@/core/theme/tokens';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { Stat } from '@/ui/widgets';
import { useWalkStore } from '@/store/useWalkStore';

/** «14 марта, суббота» — без года: год виден по порядку, а место занимает. */
function formatDay(dateKey: string, timeZone: string): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      timeZone,
      day: 'numeric',
      month: 'long',
      weekday: 'long',
    }).format(date);
  } catch {
    return dateKey;
  }
}

function formatTime(timestamp: number, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));
  } catch {
    return '';
  }
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();

  // Пересчитывается после каждой прогулки: счётчик ячеек растёт вместе
  // с ними и служит признаком «данные изменились».
  const exploredCells = useWalkStore((s) => s.exploredCells);

  const profile = getProfile();
  const timeZone = profile.timeZone === 'UTC' ? deviceTimeZone() : profile.timeZone;

  const { walks, days, week, month, all } = useMemo(() => {
    const rows = listWalks();
    const now = Date.now();
    return {
      walks: rows,
      days: groupByDay(rows, timeZone),
      week: totalsSince(rows, 7, now),
      month: totalsSince(rows, 30, now),
      all: totalsOf(rows),
    };
  }, [exploredCells, timeZone]);

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="История"
        subtitle={`${all.walks} прогулок · ${formatDistance(all.distanceM)} всего`}
        topInset={insets.top}
        onClose={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.row}>
          <Stat label="ЗА НЕДЕЛЮ" value={formatDistance(week.distanceM)} />
          <Stat label="ЗА МЕСЯЦ" value={formatDistance(month.distanceM)} />
          <Stat label="ВСЕГО" value={formatDistance(all.distanceM)} />
        </View>

        <View style={styles.row}>
          <Stat label="ПРОГУЛОК" value={String(all.walks)} />
          <Stat label="В ПУТИ" value={formatDuration(all.durationS)} />
          <Stat label="КЛЕТОК" value={String(all.newCells)} />
        </View>

        {walks.length === 0 && (
          <View style={styles.empty}>
            <Feather name="map" size={28} color={palette.textMuted} />
            <Text style={styles.emptyTitle}>Прогулок пока нет</Text>
            <Text style={styles.emptyBody}>
              Запись включится сама, когда вы выйдете из дома. Первая прогулка появится здесь.
            </Text>
          </View>
        )}

        {days.map((day) => (
          <View key={day.dateKey} style={styles.day}>
            <View style={styles.dayHead}>
              <Text style={styles.dayTitle}>{formatDay(day.dateKey, timeZone).toUpperCase()}</Text>
              <Text style={styles.dayTotal}>{formatDistance(day.totals.distanceM)}</Text>
            </View>

            {day.rows.map((walk) => (
              <View key={walk.id} style={styles.walk}>
                <View style={styles.walkIcon}>
                  <Feather
                    name={walk.isNight ? 'moon' : 'sun'}
                    size={16}
                    color={walk.isNight ? palette.plum : palette.gold}
                  />
                </View>

                <Text style={styles.walkTime}>{formatTime(walk.startedAt, timeZone)}</Text>

                <Text style={styles.walkDistance}>{formatDistance(walk.distanceM)}</Text>

                <Text style={styles.walkMeta}>
                  {formatDuration(walk.durationS)} · {walk.newCells} клеток
                </Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.dune },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  row: { flexDirection: 'row', gap: spacing.sm },

  day: {
    borderRadius: radii.lg,
    borderWidth: 4,
    borderColor: palette.ink,
    backgroundColor: palette.parchment,
    overflow: 'hidden',
  },
  dayHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: palette.sand,
    borderBottomWidth: 3,
    borderBottomColor: palette.ink,
  },
  dayTitle: { color: palette.textDark, fontFamily: fonts.display, fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },
  dayTotal: { color: palette.emberDeep, fontFamily: fonts.mono, fontSize: 16 },

  walk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  walkIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: palette.ink,
    backgroundColor: palette.parchmentBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walkTime: { color: palette.textMuted, fontFamily: fonts.mono, fontSize: 15, width: 52 },
  walkDistance: {
    color: palette.textDark,
    fontFamily: fonts.display,
    fontWeight: '900',
    fontSize: 15,
    width: 70,
  },
  walkMeta: { color: palette.textMuted, fontFamily: fonts.body, fontSize: 12, flex: 1 },

  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: radii.lg,
    borderWidth: 4,
    borderStyle: 'dashed',
    borderColor: palette.textMuted,
  },
  emptyTitle: { color: palette.textDark, fontFamily: fonts.display, fontWeight: '900', fontSize: 16 },
  emptyBody: { color: palette.textMuted, fontFamily: fonts.body, fontSize: 13, textAlign: 'center' },
});
