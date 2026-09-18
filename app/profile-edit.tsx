/**
 * Кто я: имя и аватар.
 *
 * Имя уходит и на сервер: друзья читают его из общей таблицы, и без этого
 * у брата ты навсегда останешься «Другом». Аватар остаётся на телефоне —
 * хранилища картинок у нас нет, и заводить его ради кружка рано.
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

import { getProfile, updateProfile } from '@/core/db/repo';
import { palette, radii, spacing } from '@/core/theme/tokens';
import { createFriendsProvider, isServerConfigured } from '@/features/friends';
import { DEMO_CENTER } from '@/features/places/seed';
import { Avatar } from '@/features/profile/Avatar';
import { AVATAR_PRESETS, presetAvatarValue } from '@/features/profile/avatars';
import { pickAvatarPhoto } from '@/features/profile/photo';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { ActionButton } from '@/ui/widgets';

const NAME_LIMIT = 24;

export default function ProfileEditScreen() {
  const insets = useSafeAreaInsets();
  const profile = getProfile();

  const [name, setName] = useState(profile.displayName ?? '');
  const [avatar, setAvatar] = useState(profile.avatar);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const origin =
    profile.originLat != null && profile.originLng != null
      ? { lat: profile.originLat, lng: profile.originLng }
      : { lat: DEMO_CENTER[1], lng: DEMO_CENTER[0] };

  const choosePhoto = useCallback(async () => {
    setMessage(null);
    const result = await pickAvatarPhoto(avatar);

    if (result.status === 'saved') {
      setAvatar(result.value);
      return;
    }
    if (result.status === 'denied') {
      setMessage({ text: 'Нет доступа к фотографиям — разрешите его в настройках', ok: false });
      return;
    }
    if (result.status === 'needs-rebuild') {
      setMessage({
        text: 'Выбор фотографии появится после пересборки: подключите телефон кабелем и выполните npm run setup:ios. Значки работают и так.',
        ok: false,
      });
      return;
    }
    if (result.status === 'failed') {
      setMessage({ text: 'Не получилось взять фотографию', ok: false });
    }
  }, [avatar]);

  const save = useCallback(async () => {
    const trimmed = name.trim();
    setBusy(true);
    setMessage(null);

    // Сначала база: имя должно сохраниться, даже если сети нет.
    updateProfile({ displayName: trimmed.length > 0 ? trimmed : null, avatar });

    if (trimmed.length > 0 && isServerConfigured()) {
      const provider = createFriendsProvider(origin);
      try {
        await provider.setDisplayName?.(trimmed);
      } catch {
        setBusy(false);
        setMessage({
          text: 'Сохранил на телефоне, но друзьям имя не ушло — нет связи с сервером',
          ok: false,
        });
        return;
      }
    }

    setBusy(false);
    router.back();
  }, [avatar, name, origin.lat, origin.lng]);

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Кто я"
        subtitle="Имя видят друзья, аватар — только вы"
        topInset={insets.top}
        onClose={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.preview}>
          <Avatar value={avatar} size={96} name={name} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>ИМЯ</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Как вас зовут"
            placeholderTextColor={palette.textMuted}
            maxLength={NAME_LIMIT}
            style={styles.input}
            returnKeyType="done"
          />
          <Text style={styles.hint}>
            {isServerConfigured()
              ? 'Под этим именем вас видят друзья на карте.'
              : 'Сервер не настроен, имя останется только на телефоне.'}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>АВАТАР</Text>

          <View style={styles.grid}>
            {AVATAR_PRESETS.map((preset) => {
              const value = presetAvatarValue(preset.id);
              const chosen = avatar === value;
              return (
                <Pressable
                  key={preset.id}
                  onPress={() => setAvatar(value)}
                  style={({ pressed }) => [
                    styles.tile,
                    { backgroundColor: preset.color },
                    chosen && styles.tileChosen,
                    pressed && styles.tilePressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={preset.label}
                >
                  <Feather name={preset.icon} size={22} color={palette.parchmentBright} />
                </Pressable>
              );
            })}
          </View>

          <ActionButton label="ВЫБРАТЬ ФОТОГРАФИЮ" tone="ghost" onPress={() => void choosePhoto()} />
        </View>

        {message != null && (
          <Text style={message.ok ? styles.ok : styles.error}>{message.text}</Text>
        )}

        {busy ? (
          <ActivityIndicator color={palette.ember} />
        ) : (
          <ActionButton label="СОХРАНИТЬ" onPress={() => void save()} />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.dune },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  preview: { alignItems: 'center', paddingVertical: spacing.sm },
  card: {
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 4,
    borderColor: palette.ink,
    backgroundColor: palette.parchment,
    gap: spacing.sm,
  },
  cardTitle: { color: palette.textMuted, fontWeight: '900', letterSpacing: 1, fontSize: 12 },
  input: {
    borderWidth: 3,
    borderColor: palette.ink,
    borderRadius: radii.md,
    backgroundColor: palette.parchmentBright,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: palette.textDark,
    fontSize: 16,
    fontWeight: '700',
  },
  hint: { color: palette.textMuted, fontSize: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Выбранный значок обведён светлым кольцом: рамка есть у всех,
  // отличать надо чем-то другим.
  tileChosen: { borderColor: palette.parchmentBright, borderWidth: 5 },
  tilePressed: { transform: [{ translateY: 2 }] },
  ok: { color: palette.teal, fontWeight: '700' },
  error: { color: palette.rust, fontWeight: '700' },
});
