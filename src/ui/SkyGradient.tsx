/**
 * Небо в шапке.
 *
 * В акве это настоящий градиент, нарисованный в Skia. Раньше он набирался
 * семью полосами по 22 пикселя — на экране они и читались как семь полос,
 * а в макете переход сплошной. Нативный expo-linear-gradient сюда не
 * годится: его нельзя доставить обновлением по воздуху, а Skia в проекте
 * уже есть — ею рисуется туман.
 *
 * В сумерках полосы остаются: там это закат из макета, и дискретность
 * в нём была задумана.
 */

import React, { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Canvas, LinearGradient, Rect, vec } from '@shopify/react-native-skia';

import { palette, skyBands, themeName } from '@/core/theme/tokens';

export function SkyGradient() {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((previous) =>
      previous.width === width && previous.height === height ? previous : { width, height },
    );
  };

  if (themeName === 'dusk') {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {skyBands.map((color) => (
          <View key={color} style={[styles.band, { backgroundColor: color }]} />
        ))}
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={onLayout}>
      {size.height > 0 && (
        <Canvas style={StyleSheet.absoluteFill}>
          <Rect x={0} y={0} width={size.width} height={size.height}>
            <LinearGradient
              start={vec(0, 0)}
              end={vec(0, size.height)}
              colors={[...skyBands]}
            />
          </Rect>
        </Canvas>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  band: { flex: 1, width: '100%', backgroundColor: palette.bark },
});
