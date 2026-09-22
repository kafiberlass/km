import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

import { resetDatabase } from '@/core/db/client';
import { buildSnapshot, countCells, getProfile, unlockedAchievements } from '@/core/db/repo';
import { ACHIEVEMENTS } from '@/core/rules/achievements';
import { formatSteps, stepsFromMeters } from '@/core/rules/steps';
import { daysWord, deviceTimeZone, localDateKey } from '@/core/rules/streak';
import { levelTitle, levelXpRequirement } from '@/core/rules/xp';
import { isServerConfigured } from '@/features/friends';
import { Avatar } from '@/features/profile/Avatar';
import { fonts, line, palette, pressStyle, radii, spacing, text } from '@/core/theme/tokens';
import { badgeFor } from '@/ui/badges';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { ActionButton } from '@/ui/widgets';
import { useWalkStore } from '@/store/useWalkStore';

/** Титулов по уровням ещё нет — он один на всё приложение, как и на карте. */

/** Сколько плиток ачивок помещается в строку профиля до «+N». */
const RECENT_BADGES = 3;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const exploredCells = useWalkStore((s) => s.exploredCells);
  const level = useWalkStore((s) => s.level);
  const districtsDone = useWalkStore((s) => s.districtsDone);
  const xp = useWalkStore((s) => s.xp);
  const hydrate = useWalkStore((s) => s.hydrate);
  const displayName = useWalkStore((s) => s.displayName);
  const avatar = useWalkStore((s) => s.avatar);

  const serverReady = isServerConfigured();
  const profile = getProfile();
  const { snapshot, unlocked } = useMemo(
    () => ({
      snapshot: buildSnapshot(Math.max(1, countCells())),
      unlocked: unlockedAchievements(),
    }),
    [exploredCells],
  );

  const timeZone = profile.timeZone === 'UTC' ? deviceTimeZone() : profile.timeZone;

  // То же число, что на огоньке в шапке карты: оба считаются из прогулок.
  const streak = useWalkStore((s) => s.streakDays);

  // Порядок ачивок в списке правил заодно задаёт порядок плиток: свежие
  // окажутся в конце, поэтому показываем последние полученные.
  const earned = ACHIEVEMENTS.filter((a) => unlocked.has(a.code));
  const shown = earned.slice(-RECENT_BADGES);
  const rest = earned.length - shown.length;

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={displayName ?? levelTitle(level)}
        subtitle={`${levelTitle(level)} · уровень ${level} · ${streak} ${daysWord(streak)} подряд`}
        topInset={insets.top}
        avatar={
          <Pressable
            onPress={() => router.push('/profile-edit')}
            style={({ pressed }) => [styles.avatarTap, pressed && styles.settingsPressed]}
            accessibilityRole="button"
            accessibilityLabel="Изменить имя и аватар"
          >
            <Avatar value={avatar} size={72} name={displayName} />
            <View style={styles.avatarEdit}>
              <Feather name="edit-2" size={12} color={palette.textDark} />
            </View>
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.tiles}>
          <Tile
            value={(snapshot.totalDistanceM / 1000).toFixed(1)}
            label="км пройдено"
            color={palette.emberDeep}
          />
          <Tile
            value={`≈${formatSteps(stepsFromMeters(snapshot.totalDistanceM))}`}
            label="шагов"
            color={palette.gold}
          />
          <Tile value={String(districtsDone)} label="кварталов" color={palette.teal} />
          <Tile value={String(streak)} label={`${daysWord(streak)} подряд`} color={palette.emberDeep} />
        </View>

        {/* Нажимается вся карточка, а не только ссылка «ВСЕ»: человек
            тянется к значкам и к плитке «+23» — именно они и выглядят
            как «покажи остальные». */}
        <Pressable
          onPress={() => router.push('/achievements')}
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        >
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>ПОСЛЕДНИЕ АЧИВКИ</Text>
            <Text style={styles.cardLink}>ВСЕ ›</Text>
          </View>

          <View style={styles.badgeRow}>
            {shown.map((achievement) => {
              const badge = badgeFor(achievement.code);
              return (
                <View
                  key={achievement.code}
                  style={[styles.badge, { backgroundColor: badge.color }]}
                >
                  <Feather name={badge.icon} size={22} color={palette.parchmentBright} />
                </View>
              );
            })}

            {/* Пустая пунктирная плитка: сколько ещё ачивок не поместилось
                или, пока их нет вовсе, сколько всего можно получить. */}
            <View style={[styles.badge, styles.badgeMore]}>
              <Text style={styles.badgeMoreText}>
                +{rest > 0 ? rest : ACHIEVEMENTS.length - earned.length}
              </Text>
            </View>
          </View>
        </Pressable>

        <Pressable
          onPress={() => router.push('/history')}
          style={({ pressed }) => [styles.friends, pressed && styles.settingsPressed]}
        >
          <Feather name="clock" size={18} color={palette.textDark} />
          <Text style={styles.friendsText}>ИСТОРИЯ ПРОГУЛОК</Text>
          <Feather name="chevron-right" size={18} color={palette.textDark} />
        </Pressable>

        <Pressable
          onPress={() => router.push('/week')}
          style={({ pressed }) => [styles.friends, pressed && styles.settingsPressed]}
        >
          <Feather name="bar-chart-2" size={18} color={palette.textDark} />
          <Text style={styles.friendsText}>НЕДЕЛЯ С ДРУЗЬЯМИ</Text>
          <Feather name="chevron-right" size={18} color={palette.textDark} />
        </Pressable>

        <Pressable
          onPress={() => router.push('/friends')}
          style={({ pressed }) => [styles.friends, pressed && styles.settingsPressed]}
        >
          <Feather name="users" size={18} color={palette.textDark} />
          <Text style={styles.friendsText}>ДРУЗЬЯ</Text>
          <Feather name="chevron-right" size={18} color={palette.textDark} />
        </Pressable>

        <Pressable
          onPress={() => router.push('/offline')}
          style={({ pressed }) => [styles.friends, pressed && styles.settingsPressed]}
        >
          <Feather name="download" size={18} color={palette.textDark} />
          <Text style={styles.friendsText}>КАРТА ОФЛАЙН</Text>
          <Feather name="chevron-right" size={18} color={palette.textDark} />
        </Pressable>

        <Pressable
          onPress={() => router.push('/backup')}
          style={({ pressed }) => [styles.friends, pressed && styles.settingsPressed]}
        >
          <Feather name="save" size={18} color={palette.textDark} />
          <Text style={styles.friendsText}>РЕЗЕРВНАЯ КОПИЯ</Text>
          <Feather name="chevron-right" size={18} color={palette.textDark} />
        </Pressable>

        <Pressable
          onPress={() => router.push('/theme')}
          style={({ pressed }) => [styles.friends, pressed && styles.settingsPressed]}
        >
          <Feather name="droplet" size={18} color={palette.textDark} />
          <Text style={styles.friendsText}>ОФОРМЛЕНИЕ</Text>
          <Feather name="chevron-right" size={18} color={palette.textDark} />
        </Pressable>

        <Pressable
          onPress={() => router.push('/update')}
          style={({ pressed }) => [styles.friends, pressed && styles.settingsPressed]}
        >
          <Feather name="refresh-cw" size={18} color={palette.textDark} />
          <Text style={styles.friendsText}>ОБНОВЛЕНИЕ</Text>
          <Feather name="chevron-right" size={18} color={palette.textDark} />
        </Pressable>

        <Pressable
          onPress={() => router.push('/dev')}
          style={({ pressed }) => [styles.settings, pressed && styles.settingsPressed]}
        >
          <Feather name="settings" size={18} color={palette.parchmentBright} />
          <Text style={styles.settingsText}>НАСТРОЙКИ</Text>
        </Pressable>

        {/* Текст переписан: он был написан до того, как появились
            друзья и резервная копия, и с тех пор обещал не то. */}
        <View style={styles.note}>
          <Text style={styles.noteTitle}>Что остаётся на телефоне</Text>
          <Text style={styles.noteBody}>
            Маршруты прогулок, туман, уровень и ачивки живут только здесь и никуда
            не уходят. Даже друзьям не видно, где вы ходили, — им видно только то,
            что ниже.
          </Text>
          <Text style={styles.noteTitle}>Что видят друзья</Text>
          <Text style={styles.noteBody}>
            {serverReady
              ? 'Имя, аватарку, километры за неделю, места, до которых вы дошли, и последнюю точку — во время прогулки, а круглосуточно только если вы включили это на экране друзей. Не друзьям не видно ничего.'
              : 'Ничего: приложение собрано без ключей от сервера, и друзья в нём выдуманные.'}
          </Text>
          <Text style={styles.noteTitle}>Новый телефон</Text>
          <Text style={styles.noteBody}>
            Прогресс переносится файлом: «Резервная копия» выше. Сама по себе
            история на новый телефон не приедет — сервера для неё нет.
          </Text>
          <Text style={styles.noteBody}>
            До следующего уровня: {levelXpRequirement(level) - xp} XP · Таймзона: {timeZone}
          </Text>
        </View>

        <ActionButton
          label="СБРОСИТЬ ПРОГРЕСС"
          tone="ghost"
          onPress={() => {
            resetDatabase();
            hydrate();
          }}
        />
      </ScrollView>
    </View>
  );
}

function Tile({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <View style={styles.tile}>
      <Text style={[styles.tileValue, { color }]}>{value}</Text>
      <Text style={styles.tileLabel}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.dune },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },

  avatarTap: { alignItems: 'center' },
  avatarEdit: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: line,
    borderColor: palette.edgeSoft,
    backgroundColor: palette.parchmentBright,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Сетка два на два: плиток стало четыре, а вчетвером в строке они
  // сжимаются до нечитаемых.
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    flexGrow: 1,
    flexBasis: '47%',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    borderWidth: line,
    borderColor: palette.edgeSoft,
    backgroundColor: palette.parchmentBright,
    alignItems: 'center',
    gap: 4,
  },
  tileValue: { fontSize: text.value, fontFamily: fonts.display, fontWeight: '900', fontVariant: ['tabular-nums'] },
  tileLabel: { color: palette.textMuted, fontSize: text.label, letterSpacing: 1, textAlign: 'center' },

  card: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: line,
    borderColor: palette.edgeSoft,
    backgroundColor: palette.parchmentBright,
    gap: spacing.md,
  },
  cardPressed: { ...pressStyle },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: palette.textDark, fontFamily: fonts.display, fontWeight: '900', letterSpacing: 1 },
  cardLink: { color: palette.emberDeep, fontFamily: fonts.display, fontWeight: '900', letterSpacing: 1 },
  badgeRow: { flexDirection: 'row', gap: spacing.sm },
  badge: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    borderWidth: line,
    borderColor: palette.edgeSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeMore: {
    backgroundColor: palette.sand,
    borderStyle: 'dashed',
    borderColor: palette.textMuted,
  },
  badgeMoreText: { color: palette.textMuted, fontFamily: fonts.display, fontWeight: '900' },

  friends: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: line,
    borderColor: palette.edgeSoft,
    backgroundColor: palette.parchmentBright,
  },
  friendsText: { color: palette.textDark, fontFamily: fonts.display, fontWeight: '900', letterSpacing: 1 },
  settings: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: line,
    borderColor: palette.edgeSoft,
    backgroundColor: palette.bark,
  },
  settingsPressed: { ...pressStyle },
  settingsText: { color: palette.parchmentBright, fontFamily: fonts.display, fontWeight: '900', letterSpacing: 1 },

  note: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: line,
    borderColor: palette.edgeSoft,
    backgroundColor: palette.fog,
    gap: 6,
  },
  noteTitle: { color: palette.gold, fontFamily: fonts.display, fontWeight: '900' },
  noteBody: { color: palette.parchment, lineHeight: 20 },
});
