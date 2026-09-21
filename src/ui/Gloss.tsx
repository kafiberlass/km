/**
 * Стекло по макету: четыре слоя и жёсткий стык на 46/47%.
 *
 * Стык — самое важное. Без него получается обычный градиент, а не
 * Frutiger Aero: в том стиле блик всегда обрывается резко, будто свет
 * отражается от изогнутой поверхности и на середине уходит.
 *
 * Слои снизу вверх:
 *   1. заливка самого элемента (его backgroundColor);
 *   2. блик по верхним 46% — белый 95%;
 *   3. нижняя половина с 47% — белый 28%, отражённый свет;
 *   4. волосяная белая линия по верхней кромке (в вебе это inset 0 1px 0).
 *
 * Всё обычными View. Честный градиент дал бы мягче, но это
 * expo-linear-gradient — нативный модуль, а такие не доставить
 * обновлением по воздуху: пришлось бы пересобирать и переустанавливать
 * приложение всем.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';

import { palette, radii, themeName } from '@/core/theme/tokens';

interface Props {
  /** Скругление элемента, на котором лежит блик: должно совпадать. */
  radius?: number;
  /** Где обрывается блик. По макету — 46%. */
  seam?: `${number}%`;
  /** Нажатое состояние: блик уходит вниз, свет переворачивается. */
  pressed?: boolean;
}

export function Gloss({ radius = radii.md, seam = '46%', pressed = false }: Props) {
  // В сумерках стекла нет вовсе: там границу держит чёрный контур,
  // и белое пятно поверх него выглядело бы грязью на бумаге.
  if (themeName === 'dusk') return null;

  if (pressed) {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Нажатие — инверсия: сверху тень, снизу свет. По макету
            элемент при этом не съезжает вниз: стекло не ездит. */}
        <View style={[styles.pressedTop, { height: seam, borderRadius: radius }]} />
        <View style={[styles.pressedBottom, { borderRadius: radius }]} />
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View
        style={[
          styles.top,
          {
            height: seam,
            borderTopLeftRadius: radius,
            borderTopRightRadius: radius,
          },
        ]}
      />

      {/* Начинается на процент ниже — тот самый разрыв, из которого
          и получается стеклянная, а не «залитая» поверхность. */}
      <View
        style={[
          styles.bottom,
          { top: seamPlusOne(seam), borderBottomLeftRadius: radius, borderBottomRightRadius: radius },
        ]}
      />

      <View style={[styles.hairline, { borderTopLeftRadius: radius, borderTopRightRadius: radius }]} />
    </View>
  );
}

/** «46%» -> «47%»: единица разрыва, ради которой всё и затевалось. */
function seamPlusOne(seam: `${number}%`): `${number}%` {
  const value = Number.parseFloat(seam);
  return `${Number.isFinite(value) ? value + 1 : 47}%`;
}

const styles = StyleSheet.create({
  top: { backgroundColor: palette.gloss },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  hairline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  pressedTop: { backgroundColor: 'rgba(5, 54, 79, 0.10)' },
  pressedBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '46%',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
});
