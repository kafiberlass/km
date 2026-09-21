/**
 * Блик — то, из чего сделан весь Frutiger Aero.
 *
 * Белое пятно по верхней половине элемента: именно оно превращает плоский
 * прямоугольник в кусок мокрого стекла. Внизу добавляется едва заметное
 * свечение — отражённый свет снизу, как у капли на столе.
 *
 * Обычные View, без градиентов: expo-linear-gradient — нативный модуль,
 * а такие нельзя доставить обновлением по воздуху. Двух полупрозрачных
 * слоёв для этого эффекта достаточно.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';

import { palette, radii } from '@/core/theme/tokens';

interface Props {
  /** Скругление элемента, на котором лежит блик: должно совпадать. */
  radius?: number;
  /** Какую долю высоты занимает блик. */
  height?: `${number}%`;
  /** Отражённый свет снизу. Для маленьких элементов не нужен. */
  bottomGlow?: boolean;
}

export function Gloss({ radius = radii.md, height = '52%', bottomGlow = true }: Props) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View
        style={[
          styles.top,
          {
            height,
            borderTopLeftRadius: radius,
            borderTopRightRadius: radius,
            // Нижние углы блика скруглены сильнее: так его край читается
            // как отражение, а не как вторая кнопка внутри кнопки.
            borderBottomLeftRadius: radius * 1.6,
            borderBottomRightRadius: radius * 1.6,
          },
        ]}
      />

      {bottomGlow && (
        <View
          style={[
            styles.bottom,
            { borderBottomLeftRadius: radius, borderBottomRightRadius: radius },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { backgroundColor: palette.gloss },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '22%',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
});
