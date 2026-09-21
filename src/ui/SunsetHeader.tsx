/**
 * Шапка: небо над водой.
 *
 * Полосы рисуются обычными View, а не градиентом: expo-linear-gradient —
 * нативный модуль, а его нельзя доставить обновлением по воздуху. Семи
 * полос хватает, чтобы переход читался как сплошной.
 *
 * Солнце просвечивает снизу мягким пятном, как сквозь толщу воды, —
 * в аэро свет всегда идёт из-за края экрана.
 */

import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { fonts, palette, radii, shadow, spacing, skyBands } from '@/core/theme/tokens';
import { Avatar } from '@/features/profile/Avatar';
import { Droplets } from './Droplets';
import { GrassLine } from './GrassLine';

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
  const { width } = useWindowDimensions();

  return (
    <View style={[styles.root, { minHeight: topInset + MIN_BODY_HEIGHT }]}>
      <View style={styles.bands}>
        {skyBands.map((color) => (
          <View key={color} style={[styles.band, { backgroundColor: color }]} />
        ))}
        {/* Солнце: круг, наполовину утопленный за горизонт. */}
        <View style={styles.sun} />
        <View style={styles.horizon} />

        {/* Трава по нижней кромке — та самая линия горизонта из макета. */}
        <GrassLine width={width} />
      </View>

      {/* Капли на стекле шапки. На карте их не бывает: там капля читалась
          бы как метка, то есть как место, до которого можно дойти. */}
      <Droplets count={6} seed={3} opacity={0.9} />

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
          {/* Рисованный огонь, а не эмодзи: эмодзи рисует система,
              и он выпадает из шрифта и палитры всего остального. */}
          <MaterialCommunityIcons name="fire" size={16} color={palette.gold} />
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
    backgroundColor: palette.bark,
    ...shadow,
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
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
  },
  // Волна у нижнего края: прежде здесь был тёмный холм, из-за которого
  // вставало солнце. В аэро горизонт — это вода, и она светлая.
  horizon: {
    position: 'absolute',
    left: -40,
    right: -40,
    bottom: -78,
    height: 100,
    borderTopLeftRadius: 120,
    borderTopRightRadius: 120,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    transform: [{ rotate: '2deg' }],
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
    color: palette.textDark,
    fontSize: 20,
    fontFamily: fonts.display,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontFamily: fonts.body,
    color: palette.textDark,
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
    borderColor: palette.edgeSoft,
    backgroundColor: '#3A2A1E',
  },
  streakValue: { color: palette.gold, fontFamily: fonts.display, fontWeight: '900', fontSize: 16 },
});
