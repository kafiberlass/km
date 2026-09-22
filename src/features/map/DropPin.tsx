/**
 * Метка-капля: круг с острым носиком вниз.
 *
 * Круглая метка отвечает на вопрос «кто», но не отвечает «где именно»:
 * у круга нет точки, он висит над местом. У капли носик упирается
 * в землю — и глаз читает координату однозначно.
 *
 * Форма собрана из квадрата со скруглениями: три угла круглые, нижний
 * левый острый, всё повёрнуто на 45°. Содержимое поворачивается обратно,
 * иначе лицо в метке окажется боком. Тот же приём, что и в вебе, — SVG
 * ради одной фигуры в проект не тянем.
 */

import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { palette } from '@/core/theme/tokens';

interface Props {
  /** Диаметр круглой части. Общая высота выходит примерно в 1.3 раза больше. */
  size: number;
  /** Цвет каймы: по нему метки различаются, когда лиц ещё не разглядеть. */
  color: string;
  /** Толщина каймы. */
  border?: number;
  /** Фон под содержимым — виден, пока грузится фотография. */
  background?: string;
  style?: ViewStyle;
  children?: React.ReactNode;
}

export function DropPin({
  size,
  color,
  border = 3,
  background = palette.parchmentBright,
  style,
  children,
}: Props) {
  const radius = size / 2;

  return (
    <View style={[{ width: size, height: size * 1.3 }, styles.root, style]}>
      <View
        style={[
          styles.drop,
          {
            width: size,
            height: size,
            borderWidth: border,
            borderColor: color,
            backgroundColor: background,
            borderTopLeftRadius: radius,
            borderTopRightRadius: radius,
            borderBottomRightRadius: radius,
            // Острый угол — он и есть носик, смотрящий в землю.
            borderBottomLeftRadius: 2,
          },
        ]}
      />

      {/* Содержимое лежит поверх и не повёрнуто: его крутить нельзя. */}
      <View style={[styles.content, { width: size, height: size }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center' },
  drop: {
    position: 'absolute',
    top: 0,
    // Поворот на 45° ставит острый угол точно вниз.
    transform: [{ rotate: '45deg' }],
  },
  content: {
    position: 'absolute',
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 999,
  },
});
