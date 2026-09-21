/**
 * Капли на стекле.
 *
 * Из макета: «Капли живут на стекле панелей — и никогда на карте».
 * Правило не косметическое: капля на карте читалась бы как метка,
 * то есть как что-то, до чего можно дойти.
 *
 * Обычные View. Каждая капля — круг с бликом в левом верхнем углу
 * и тенью снизу: тот же свет, что и у стекла, просто в миниатюре.
 */

import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { themeName } from '@/core/theme/tokens';

interface Props {
  /** Сколько капель. Больше десятка — уже грязь, а не стекло. */
  count?: number;
  /** Прозрачность всей россыпи. */
  opacity?: number;
  /** Семя раскладки: у разных панелей разный узор. */
  seed?: number;
}

/** Детерминированное псевдослучайное: раскладка не должна прыгать. */
function noise(index: number, salt: number): number {
  const value = Math.sin(index * 43.7 + salt * 91.3) * 9871.233;
  return value - Math.floor(value);
}

export function Droplets({ count = 7, opacity = 1, seed = 1 }: Props) {
  const drops = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => {
        const size = 4 + noise(index, seed) * 9;
        return {
          key: index,
          size,
          left: `${4 + noise(index, seed + 1) * 88}%`,
          top: `${6 + noise(index, seed + 2) * 78}%`,
          alpha: 0.18 + noise(index, seed + 3) * 0.25,
        };
      }),
    [count, seed],
  );

  // В сумерках стекла нет — значит, и каплям не на чем держаться.
  if (themeName === 'dusk') return null;

  return (
    <View style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none">
      {drops.map((drop) => (
        <View
          key={drop.key}
          style={[
            styles.drop,
            {
              width: drop.size,
              height: drop.size,
              borderRadius: drop.size / 2,
              left: drop.left as unknown as number,
              top: drop.top as unknown as number,
              backgroundColor: `rgba(255, 255, 255, ${drop.alpha.toFixed(2)})`,
            },
          ]}
        >
          {/* Блик — та же точка, откуда светит всё остальное стекло. */}
          <View
            style={[
              styles.highlight,
              {
                width: drop.size * 0.34,
                height: drop.size * 0.34,
                borderRadius: drop.size,
                top: drop.size * 0.16,
                left: drop.size * 0.18,
              },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  drop: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.55)',
    // Снизу капля темнее — в ней собирается тень.
    shadowColor: '#05364F',
    shadowOpacity: 0.25,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  highlight: { position: 'absolute', backgroundColor: 'rgba(255, 255, 255, 0.9)' },
});
