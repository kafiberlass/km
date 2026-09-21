/**
 * Трава по нижней кромке шапки.
 *
 * Из макета: «Трава растёт по кромке открытой земли и в подвале шапки:
 * это линия горизонта, а не орнамент». Поэтому она идёт сплошной полосой
 * по низу и нигде больше: её работа — обозначить, где кончается небо.
 *
 * Skia, а не View: перо травы — это изогнутый треугольник, из
 * прямоугольников он не складывается. Полоса статичная, перерисовок нет.
 */

import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';

import { palette, themeName } from '@/core/theme/tokens';

interface Props {
  width: number;
  /** Высота полосы: по ней же считается высота самых длинных перьев. */
  height?: number;
}

function noise(index: number, salt: number): number {
  const value = Math.sin(index * 17.3 + salt * 53.7) * 4371.71;
  return value - Math.floor(value);
}

export function GrassLine({ width, height = 18 }: Props) {
  const blades = useMemo(() => {
    const path = Skia.Path.Make();
    if (width <= 0) return path;

    // Шаг в шесть пикселей: реже — забор из отдельных травинок, чаще —
    // сплошная зелёная полоса, в которой перьев уже не различить.
    const step = 6;
    for (let i = 0; i * step < width + step; i += 1) {
      const x = i * step + noise(i, 1) * 3;
      const tall = height * (0.45 + noise(i, 2) * 0.55);
      const lean = (noise(i, 3) - 0.5) * height * 0.7;
      const half = 1.6 + noise(i, 4);

      path.moveTo(x - half, height);
      path.quadTo(x + lean * 0.4, height - tall * 0.55, x + lean, height - tall);
      path.quadTo(x + lean * 0.1, height - tall * 0.45, x + half, height);
      path.close();
    }

    return path;
  }, [width, height]);

  // Горизонт из травы — примета аэро. В сумерках горизонт другой: холм.
  if (themeName === 'dusk' || width <= 0) return null;

  return (
    <Canvas style={[styles.canvas, { width, height }]} pointerEvents="none">
      {/* Второй слой позади и темнее — глубина, без неё полоса плоская. */}
      <Path path={blades} color={palette.emberDeep} opacity={0.55} />
      <Path path={blades} color={palette.ember} opacity={0.85} />
    </Canvas>
  );
}

const styles = StyleSheet.create({
  canvas: { position: 'absolute', left: 0, bottom: 0 },
});
