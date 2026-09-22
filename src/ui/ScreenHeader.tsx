/**
 * Шапка списковых экранов из макета: полосы заката, поверх них заголовок.
 *
 * Отличается от SunsetHeader на карте: там строка уровня и восходящее
 * солнце, здесь — только название экрана и счётчик под ним. Общее у них
 * одно — палитра полос, поэтому она и живёт в токенах, а не в компоненте.
 *
 * Отступ под статус-бар принимается параметром и уходит внутрь шапки:
 * полосы должны доходить до верхнего края экрана, иначе над закатом
 * повисает полоса фона.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { fonts, line, palette, spacing, text } from '@/core/theme/tokens';
import { Droplets } from './Droplets';
import { SkyGradient } from './SkyGradient';
import { GrassLine } from './GrassLine';

interface Props {
  title: string;
  subtitle?: string;
  topInset: number;
  /** Кружок «КМ» по центру — вариант для профиля. */
  avatar?: React.ReactNode;
  /**
   * Крестик в углу для экранов, открытых поверх вкладок. Свайп вниз их
   * тоже закрывает, но об этом надо знать заранее — кнопка видна сразу.
   */
  onClose?: () => void;
}

export function ScreenHeader({ title, subtitle, topInset, avatar, onClose }: Props) {
  const centered = avatar != null;
  const { width } = useWindowDimensions();

  return (
    <View style={[styles.root, { paddingTop: topInset + spacing.sm }]}>
      <View style={styles.bands} pointerEvents="none">
        <SkyGradient />
        {centered && <View style={styles.sun} />}

        {/* Линия горизонта из травы — та же, что и на главном экране. */}
        <GrassLine width={width} height={14} />
      </View>

      {onClose != null && (
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [
            styles.close,
            { top: topInset + spacing.sm },
            pressed && styles.closePressed,
          ]}
          hitSlop={spacing.md}
          accessibilityRole="button"
          accessibilityLabel="Закрыть"
        >
          <Feather name="x" size={20} color={palette.textDark} />
        </Pressable>
      )}

      {/* Капли на стекле шапки. На карте их не бывает: там капля читалась
          бы как метка, то есть как место, до которого можно дойти. */}
      <Droplets count={5} seed={7} opacity={0.85} />

      <View style={[styles.content, centered && styles.contentCentered]}>
        {avatar}
        <Text style={[styles.title, centered && styles.centeredText]} numberOfLines={1}>
          {title.toUpperCase()}
        </Text>
        {subtitle != null && (
          <Text style={[styles.subtitle, centered && styles.centeredText]} numberOfLines={1}>
            {subtitle.toUpperCase()}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderBottomWidth: line,
    borderBottomColor: palette.edge,
    backgroundColor: palette.bark,
    overflow: 'hidden',
  },
  // Полосы делят шапку поровну: так закат заполняет её целиком при любой
  // высоте статус-бара, без подгонки высоты полосы под устройство.
  bands: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'column' },
  sun: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: -20,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    opacity: 0.9,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: 2,
  },
  contentCentered: { alignItems: 'center', gap: spacing.xs },
  close: {
    position: 'absolute',
    right: spacing.lg,
    zIndex: 1,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: line,
    borderColor: palette.edgeSoft,
    backgroundColor: palette.parchmentBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closePressed: { opacity: 0.8 },
  centeredText: { textAlign: 'center' },
  title: {
    color: palette.textDark,
    fontSize: text.screen,
    fontFamily: fonts.display,
    fontWeight: '900',
    letterSpacing: 1,
    textShadowColor: 'rgba(255, 255, 255, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  subtitle: {
    fontFamily: fonts.body,
    color: palette.textMuted,
    fontSize: text.meta,
    letterSpacing: 1.5,
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(255, 255, 255, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
