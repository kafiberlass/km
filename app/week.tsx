/**
 * Неделя с друзьями.
 *
 * Смысл не в том, чтобы кого-то обогнать. Смысл в том, что видно:
 * остальные тоже ходят. Поэтому здесь нет ни кубков, ни «вы последний» —
 * просто числа рядом и полоски одной длины с лучшим результатом.
 */

import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

import { getProfile, listWalks } from '@/core/db/repo';
import { formatSteps, stepsFromMeters } from '@/core/rules/steps';
import { deviceTimeZone } from '@/core/rules/streak';
import { fonts, palette, radii, spacing } from '@/core/theme/tokens';
import { totalsSince } from '@/core/walk/history';
import { buildBoard, formatWeekDistance } from '@/features/friends/board';
import { isServerConfigured, useFriends } from '@/features/friends';
import { Avatar } from '@/features/profile/Avatar';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { useWalkStore } from '@/store/useWalkStore';

export default function WeekScreen() {
  const insets = useSafeAreaInsets();
  const exploredCells = useWalkStore((s) => s.exploredCells);
  const displayName = useWalkStore((s) => s.displayName);
  const avatar = useWalkStore((s) => s.avatar);

  const profile = getProfile();
  const origin =
    profile.originLat != null && profile.originLng != null
      ? { lat: profile.originLat, lng: profile.originLng }
      : { lat: 0, lng: 0 };

  const friends = useFriends(origin, true);

  const rows = useMemo(() => {
    const mine = totalsSince(listWalks(), 7, Date.now());

    return buildBoard(
      {
        id: 'me',
        name: displayName ?? 'Я',
        avatar,
        color: palette.ember,
        weekM: mine.distanceM,
        weekAt: Date.now(),
      },
      friends.map((friend) => ({
        id: friend.id,
        name: friend.name,
        avatar: friend.avatar,
        color: friend.color,
        weekM: friend.weekM,
        weekAt: friend.weekAt,
      })),
    );
  }, [friends, displayName, avatar, exploredCells]);

  const total = rows.reduce((sum, row) => sum + (row.weekM ?? 0), 0);

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Неделя"
        subtitle={`Вместе прошли ${formatWeekDistance(total)} за семь дней`}
        topInset={insets.top}
        onClose={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {rows.map((row) => (
          <View key={row.id} style={[styles.row, row.isMe && styles.rowMe]}>
            <Text style={styles.place}>{row.place}</Text>

            <Avatar value={row.avatar} size={38} name={row.name} />

            <View style={styles.body}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {row.name}
                  {row.isMe ? ' · вы' : ''}
                </Text>
                <Text style={styles.value}>{formatWeekDistance(row.weekM)}</Text>
              </View>

              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    { width: `${Math.round(row.share * 100)}%`, backgroundColor: row.color },
                  ]}
                />
              </View>

              <Text style={styles.meta}>
                {row.weekM == null
                  ? 'ещё не делился'
                  : `≈ ${formatSteps(stepsFromMeters(row.weekM))} шагов${row.stale ? ' · данные не свежие' : ''}`}
              </Text>
            </View>
          </View>
        ))}

        <View style={styles.note}>
          <Feather name="info" size={16} color={palette.textMuted} />
          <Text style={styles.noteText}>
            {isServerConfigured()
              ? 'Считается за последние семь дней. Телефон отправляет друзьям одно число — сколько пройдено; маршруты остаются на устройстве.'
              : 'Сервер не настроен: числа друзей выдуманы. Настоящие появятся, когда приложение обновят.'}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.dune },
  content: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.edgeSoft,
    backgroundColor: palette.parchment,
  },
  rowMe: { backgroundColor: palette.parchmentBright },
  place: {
    width: 22,
    textAlign: 'center',
    color: palette.textMuted,
    fontFamily: fonts.mono,
    fontSize: 16,
  },
  body: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
  name: {
    flex: 1,
    color: palette.textDark,
    fontFamily: fonts.display,
    fontWeight: '900',
    fontSize: 15,
  },
  value: { color: palette.emberDeep, fontFamily: fonts.mono, fontSize: 15 },
  track: {
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: palette.edgeSoft,
    backgroundColor: palette.sand,
    overflow: 'hidden',
  },
  fill: { height: '100%' },
  meta: { color: palette.textMuted, fontFamily: fonts.body, fontSize: 11 },
  note: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  noteText: { flex: 1, color: palette.textMuted, fontFamily: fonts.body, fontSize: 12 },
});
