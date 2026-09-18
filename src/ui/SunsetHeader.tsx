/**
 * Шапка с закатом из макета.
 *
 * Полосы рисуются обычными View, а не градиентом: в макете это именно
 * дискретные полосы, и так не нужна ни expo-linear-gradient, ни SVG.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fonts, palette, radii, spacing, sunsetBands } from '@/core/theme/tokens';
import { Avatar } from '@/features/profile/Avatar';

interface Props {
  level: number;
  /** Имя человека. null — ещё не представился, тогда в шапке звание. */
  name: string | null;
  /** Строка аватара из профиля: «preset:…» или «photo:…». */
  avatar: string | null;
  /** Звание по уровню — запасной вариант для верхней строки. */
  title: string;
  streakDays: number;
  /**
   * Высота статус-бара. Отступ уходит внутрь шапки, а не наружу: полосы
   * заката залиты по всей её высоте, поэтому только так они доходят
   * до верхнего края экрана. Отступ снаружи оставлял бы над закатом
   * полосу фона, а сам закат выглядел бы обрезанным.
   */
  topInset?: number;
}

export function SunsetHeader({
  level,
  name,
  avatar,
  title,
  streakDays,
  topInset = 0,
}: Props) {
  return (
    <View style={[styles.root, { minHeight: topInset + MIN_BODY_HEIGHT }]}>
      <View style={styles.bands}>
        {sunsetBands.map((color) => (
          <View key={color} style={[styles.band, { backgroundColor: color }]} />
        ))}
        {/* Солнце: круг, наполовину утопленный за горизонт. */}
        <View style={styles.sun} />
        <View style={styles.horizon} />
      </View>

      <View style={[styles.content, { paddingTop: topInset + spacing.sm }]}>
        {/* Свой аватар, а не буквы «КМ»: это экран человека, а не витрина
            приложения. Имя тоже своё — звание ушло строкой ниже и в профиль. */}
        <Avatar value={avatar} size={52} name={name} />

        <View style={styles.titleBlock}>
          <Text style={styles.title} numberOfLines={1}>
            {(name ?? title).toUpperCase()}
          </Text>
          <Text style={styles.subtitle}>УРОВЕНЬ {level}</Text>
        </View>

        <View style={styles.streak}>
          <Text style={styles.streakIcon}>🔥</Text>
          <Text style={styles.streakValue}>{streakDays}</Text>
        </View>
      </View>
    </View>
  );
}

const BAND_HEIGHT = 22;
const SUN_SIZE = 78;
const SUN_BOTTOM = 10;

/**
 * Высота шапки без статус-бара.
 *
 * Складывается из строки с именем (её высоту задаёт аватар в 52 пункта
 * плюс отступы) и места под солнце. Меньше нельзя: солнце начнёт
 * налезать на текст, а в макете оно встаёт строго под ним.
 */
const MIN_BODY_HEIGHT = 150;

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
    borderBottomLeftRadius: radii.lg,
    borderBottomRightRadius: radii.lg,
    backgroundColor: palette.plum,
  },
  bands: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  band: { height: BAND_HEIGHT, width: '100%' },
  sun: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: SUN_BOTTOM,
    width: SUN_SIZE,
    height: SUN_SIZE,
    borderRadius: SUN_SIZE / 2,
    backgroundColor: '#F7E27E',
  },
  // Холм, из-за которого встаёт солнце: видна только верхняя полоса,
  // остальное уходит под нижний край шапки.
  horizon: {
    position: 'absolute',
    left: -40,
    right: -40,
    bottom: -72,
    height: 100,
    backgroundColor: palette.ink,
    transform: [{ rotate: '4deg' }],
  },
  content: {
    // Без flex: в макете строка с уровнем прижата к верху, а под ней
    // остаётся место, из которого встаёт солнце.
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  titleBlock: { flex: 1 },
  title: {
    color: palette.textOnDark,
    fontSize: 20,
    fontFamily: fonts.display,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontFamily: fonts.body,
    color: palette.parchment,
    fontSize: 12,
    letterSpacing: 1.5,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: palette.ink,
    backgroundColor: '#3A2A1E',
  },
  streakIcon: { fontSize: 14 },
  streakValue: { color: palette.gold, fontFamily: fonts.display, fontWeight: '900', fontSize: 16 },
});
