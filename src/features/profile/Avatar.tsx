/**
 * Кружок аватара: фотография или значок.
 *
 * Один компонент на все места, где он показывается, — иначе фотография
 * окажется круглой в профиле и квадратной в шапке.
 */

import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { fonts, line, palette } from '@/core/theme/tokens';

import { initialsOf, parseAvatar } from './avatars';

interface Props {
  /** Строка из базы: «preset:…» или «photo:…». */
  value: string | null;
  size: number;
  /** Имя — из него берутся инициалы, пока аватар не выбран. */
  name?: string | null;
  /** Показывать инициалы вместо значка. */
  useInitials?: boolean;
}

export function Avatar({ value, size, name, useInitials = false }: Props) {
  const avatar = parseAvatar(value);
  const radius = size / 2;

  if (avatar.kind === 'photo') {
    return (
      <Image
        source={{ uri: avatar.uri }}
        style={[styles.circle, { width: size, height: size, borderRadius: radius }]}
        accessibilityIgnoresInvertColors
      />
    );
  }

  return (
    <View
      style={[
        styles.circle,
        styles.center,
        { width: size, height: size, borderRadius: radius, backgroundColor: avatar.preset.color },
      ]}
    >
      {useInitials ? (
        <Text style={[styles.initials, { fontSize: size * 0.34 }]}>{initialsOf(name)}</Text>
      ) : (
        <Feather name={avatar.preset.icon} size={size * 0.5} color={palette.parchmentBright} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    // Белое кольцо потолще: аватар лежит на небе, и бледная граница
    // на бледном фоне пропадала вместе с самим кругом.
    borderWidth: 2,
    borderColor: palette.parchmentBright,
    backgroundColor: palette.bark,
  },
  center: { alignItems: 'center', justifyContent: 'center' },
  initials: {
    color: palette.parchmentBright,
    fontFamily: fonts.display,
    fontWeight: '900',
    letterSpacing: 1,
    textShadowColor: 'rgba(5, 54, 79, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
