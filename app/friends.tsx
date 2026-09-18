/**
 * Экран друзей.
 *
 * Тот же провайдер, что и метки на карте, поэтому список и карта никогда
 * не расходятся: и там, и там одна подписка через useFriends.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

import { getProfile } from '@/core/db/repo';
import { haversineMeters } from '@/core/geo/mercator';
import { DEMO_CENTER } from '@/features/places/seed';
import {
  createFriendsProvider,
  isFresh,
  isServerConfigured,
  publishIfNeeded,
  sharingSetting,
  useAlwaysSharing,
  useFriends,
  type Friend,
} from '@/features/friends';
import { useMyPosition } from '@/features/tracking/useMyPosition';
import { palette, radii, spacing } from '@/core/theme/tokens';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { ActionButton } from '@/ui/widgets';

const VISIT_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  cafe: 'coffee',
  park: 'sun',
  viewpoint: 'eye',
};

/** «12 минут назад» вместо даты: на таких сроках относительное время понятнее. */
function timeAgo(timestamp: number, now: number = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - timestamp) / 60_000));
  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} мин назад`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;

  const days = Math.round(hours / 24);
  return days === 1 ? 'вчера' : `${days} дн назад`;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} м`;
  return `${(meters / 1000).toFixed(1)} км`;
}

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();

  const profile = getProfile();
  const origin =
    profile.originLat != null && profile.originLng != null
      ? { lat: profile.originLat, lng: profile.originLng }
      : { lat: DEMO_CENTER[1], lng: DEMO_CENTER[0] };

  const friends = useFriends(origin);
  const online = friends.filter((f) => f.position != null && isFresh(f.position)).length;

  const alwaysSharing = useAlwaysSharing();
  const { point: myPoint } = useMyPosition();

  const toggleSharing = useCallback(() => {
    const next = sharingSetting.toggle();
    // Включили — отправляем сразу, не дожидаясь, пока человек куда-то
    // пойдёт: иначе друзья ещё час видят вчерашнюю точку.
    if (next && myPoint) publishIfNeeded(origin, myPoint);
  }, [myPoint, origin.lat, origin.lng]);

  const [myCode, setMyCode] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  // null после загрузки — это не «ещё грузится», а «не получилось».
  // Разделяем два состояния, иначе экран молча показывает точки.
  const [codeLoaded, setCodeLoaded] = useState(false);

  useEffect(() => {
    const provider = createFriendsProvider(origin);
    if (!provider.inviteCode) return;
    void provider.inviteCode().then((code) => {
      setMyCode(code);
      setCodeLoaded(true);
    });
  }, [origin.lat, origin.lng]);

  const link = useCallback(async () => {
    const code = input.trim();
    if (code.length === 0 || busy) return;

    const provider = createFriendsProvider(origin);
    if (!provider.linkByCode) return;

    setBusy(true);
    setMessage(null);
    try {
      await provider.linkByCode(code);
      setInput('');
      setMessage({ text: 'Готово, вы друзья', ok: true });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : String(error), ok: false });
    } finally {
      setBusy(false);
    }
  }, [busy, input, origin.lat, origin.lng]);

  // Подтверждение обязательно: отменить удаление нечем, связь придётся
  // заводить заново по коду, а код друга ещё надо будет спросить.
  const remove = useCallback(
    (friend: Friend) => {
      const provider = createFriendsProvider(origin);
      if (!provider.removeFriend) return;

      Alert.alert(
        `Удалить ${friend.name}?`,
        'Вы перестанете видеть друг друга на карте. Чтобы вернуть, понадобится снова связаться по коду.',
        [
          { text: 'Отмена', style: 'cancel' },
          {
            text: 'Удалить',
            style: 'destructive',
            onPress: () => {
              void provider
                .removeFriend?.(friend.id)
                // Формулировка без рода: имя друга приходит с сервера,
                // и «удалён» или «удалена» — не угадать.
                .then(() => setMessage({ text: `${friend.name} — больше не в друзьях`, ok: true }))
                .catch((error: unknown) => {
                  setMessage({
                    text: error instanceof Error ? error.message : String(error),
                    ok: false,
                  });
                });
            },
          },
        ],
      );
    },
    [origin.lat, origin.lng],
  );

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Друзья"
        subtitle={`${friends.length} всего · ${online} на прогулке`}
        topInset={insets.top}
        onClose={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.cardTitle}>ТВОЙ КОД</Text>
          <Text style={styles.code}>{myCode ?? '······'}</Text>

          {myCode != null || !codeLoaded ? (
            <Text style={styles.hint}>
              Продиктуйте его другу — он введёт код у себя, и вы увидите друг друга на карте.
            </Text>
          ) : (
            <Text style={styles.error}>
              Код не пришёл. Чаще всего это значит, что в Supabase выключен анонимный вход:
              Authentication → Providers → Anonymous sign-ins. Причина целиком — в логе Metro,
              строка «[friends]».
            </Text>
          )}

          <View style={styles.linkRow}>
            <TextInput
              value={input}
              onChangeText={(value) => setInput(value.toUpperCase())}
              placeholder="КОД ДРУГА"
              placeholderTextColor={palette.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={8}
              style={styles.input}
              onSubmitEditing={() => void link()}
              returnKeyType="done"
            />
            <ActionButton
              label={busy ? '…' : 'СВЯЗАТЬ'}
              onPress={() => void link()}
              disabled={busy || input.trim().length === 0}
            />
          </View>

          {message != null && (
            <Text style={message.ok ? styles.ok : styles.error}>{message.text}</Text>
          )}
        </View>

        {friends.map((friend) => (
          <FriendCard
            key={friend.id}
            friend={friend}
            origin={origin}
            onRemove={() => remove(friend)}
          />
        ))}

        {isServerConfigured() ? (
          <View style={styles.note}>
            <View style={styles.shareRow}>
              <View style={styles.shareBody}>
                <Text style={styles.noteTitle}>
                  {alwaysSharing ? 'Делюсь позицией всегда' : 'Делюсь только на прогулке'}
                </Text>
                <Text style={styles.noteBody}>
                  {alwaysSharing
                    ? 'Друзья видят, где вы, и когда прогулка не идёт. Позиция уходит не чаще раза в минуту и ста метров, а пока вы стоите на месте — не уходит вовсе.'
                    : 'Пока прогулка не идёт, друзья видят вашу последнюю точку и время, когда она обновлялась. Включите, чтобы метка ехала за вами всегда.'}
                </Text>
              </View>

              <Switch
                value={alwaysSharing}
                onValueChange={toggleSharing}
                trackColor={{ false: palette.sand, true: palette.ember }}
                thumbColor={palette.parchmentBright}
                accessibilityLabel="Круглосуточная трансляция позиции"
              />
            </View>
          </View>
        ) : (
          <View style={styles.note}>
            <Text style={styles.noteTitle}>Данные демонстрационные</Text>
            <Text style={styles.noteBody}>
              Сервер не настроен, друзья ненастоящие: их рисует встроенный
              демо-провайдер. Чтобы увидеть живого человека, задайте адрес проекта
              и публичный ключ — инструкция в README, схема в docs/supabase.sql.
            </Text>
          </View>
        )}

        <ActionButton label="ЗАКРЫТЬ" tone="ghost" onPress={() => router.back()} />
      </ScrollView>
    </View>
  );
}

/**
 * Куда вести с карточки друга.
 *
 * Живая позиция, если он на прогулке; иначе последнее место, где он был.
 * Возвращает null, когда показывать нечего, — и тогда карточка не нажимается
 * вовсе, вместо того чтобы открыть карту неизвестно где.
 */
function friendTarget(friend: Friend): { lat: number; lng: number } | null {
  if (friend.position) return { lat: friend.position.lat, lng: friend.position.lng };
  const visit = friend.visits[0];
  return visit ? { lat: visit.lat, lng: visit.lng } : null;
}

function FriendCard({
  friend,
  origin,
  onRemove,
}: {
  friend: Friend;
  origin: { lat: number; lng: number };
  onRemove: () => void;
}) {
  const position = friend.position;
  const fresh = position != null && isFresh(position);
  const target = friendTarget(friend);

  const open = () => {
    if (!target) return;
    router.push({
      pathname: '/map-full',
      params: { lng: String(target.lng), lat: String(target.lat), friend: friend.name },
    });
  };

  return (
    <View style={styles.card}>
      <Pressable
        onPress={open}
        disabled={target == null}
        style={({ pressed }) => [styles.head, pressed && target != null && styles.headPressed]}
        accessibilityRole="button"
        accessibilityLabel={
          target ? `Показать ${friend.name} на карте` : `${friend.name} не делится позицией`
        }
      >
        <View style={[styles.avatar, { backgroundColor: friend.color }, !fresh && styles.dim]}>
          <Text style={styles.avatarText}>{friend.initials}</Text>
        </View>

        <View style={styles.headBody}>
          <Text style={styles.name}>{friend.name.toUpperCase()}</Text>
          <Text style={styles.status}>
            {position == null
              ? 'НЕ ДЕЛИТСЯ ПОЗИЦИЕЙ'
              : `${formatDistance(haversineMeters(origin, position))} ОТ ТЕБЯ · ${timeAgo(
                  position.updatedAt,
                ).toUpperCase()}`}
          </Text>
        </View>

        {/* Точка «на прогулке» — единственный признак, который виден
            мгновенно, без чтения строки статуса. */}
        <View style={[styles.dot, fresh ? styles.dotLive : styles.dotStale]} />

        {/* Стрелка вместо подписи «нажми сюда»: она же показывает,
            что карточка ведёт дальше. */}
        {target != null && (
          <Feather name="chevron-right" size={18} color={palette.textMuted} />
        )}

        <Pressable
          onPress={onRemove}
          hitSlop={spacing.sm}
          style={({ pressed }) => [styles.remove, pressed && styles.removePressed]}
          accessibilityRole="button"
          accessibilityLabel={`Удалить ${friend.name}`}
        >
          <Feather name="trash-2" size={16} color={palette.textMuted} />
        </Pressable>
      </Pressable>

      {friend.visits.length > 0 && (
        <View style={styles.visits}>
          {friend.visits.map((visit) => (
            <View key={visit.id} style={styles.visit}>
              <View style={[styles.visitIcon, { borderColor: friend.color }]}>
                <Feather
                  name={VISIT_ICONS[visit.type] ?? 'map-pin'}
                  size={14}
                  color={palette.textDark}
                />
              </View>
              <Text style={styles.visitTitle} numberOfLines={1}>
                {visit.title}
              </Text>
              <Text style={styles.visitTime}>{timeAgo(visit.visitedAt)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.dune },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },

  card: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 3,
    borderColor: palette.ink,
    backgroundColor: palette.parchmentBright,
    gap: spacing.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  shareBody: { flex: 1, gap: spacing.xs },
  headPressed: { opacity: 0.7 },
  headBody: { flex: 1, gap: 2 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 3,
    borderColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: { opacity: 0.55 },
  avatarText: { color: palette.parchmentBright, fontWeight: '900', fontSize: 15 },
  name: { color: palette.textDark, fontWeight: '900', fontSize: 16, letterSpacing: 0.5 },
  status: { color: palette.textMuted, fontSize: 11, letterSpacing: 0.8 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: palette.ink },
  dotLive: { backgroundColor: palette.ember },
  dotStale: { backgroundColor: palette.sand },

  remove: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: palette.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePressed: { transform: [{ translateY: 2 }] },

  visits: { gap: spacing.sm, borderTopWidth: 2, borderTopColor: '#00000018', paddingTop: spacing.sm },
  visit: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  visitIcon: {
    width: 30,
    height: 30,
    borderRadius: radii.sm,
    borderWidth: 3,
    backgroundColor: palette.parchment,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visitTitle: { flex: 1, color: palette.textDark, fontWeight: '800', fontSize: 13 },
  visitTime: { color: palette.textMuted, fontSize: 11 },

  cardTitle: { color: palette.textDark, fontWeight: '900', letterSpacing: 1 },
  code: {
    color: palette.emberDeep,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 6,
    fontVariant: ['tabular-nums'],
  },
  hint: { color: palette.textMuted, fontSize: 12, lineHeight: 17 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 3,
    borderColor: palette.ink,
    backgroundColor: palette.parchment,
    color: palette.textDark,
    fontWeight: '900',
    letterSpacing: 2,
  },
  ok: { color: palette.teal, fontWeight: '800' },
  error: { color: palette.rust, fontWeight: '800' },

  note: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 3,
    borderColor: palette.ink,
    backgroundColor: palette.fog,
    gap: 6,
  },
  noteTitle: { color: palette.gold, fontWeight: '900' },
  noteBody: { color: palette.parchment, lineHeight: 20 },
});
