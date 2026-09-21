/**
 * Примитивы Frutiger Aero: стекло, небо, трава, пузыри.
 *
 * Градиенты рисуются на Skia, а не через expo-linear-gradient: Skia уже
 * в зависимостях ради тумана, а лишний нативный модуль — это ещё один
 * prebuild и ещё одна библиотека, которая может отстать от версии RN.
 *
 * Стекло, наоборот, собрано из обычных View. Его градиент ступенчатый —
 * на 46/47% жёсткий стык, — а ступеньку два прямоугольника дают точнее
 * и дешевле, чем настоящий градиент.
 */

import React, { useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';
import {
  Canvas,
  Circle,
  Group,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Skia,
  vec,
} from '@shopify/react-native-skia';

import { glassStops, headerBands, palette, shadows, skyBands, theme } from '@/core/theme/tokens';
import { grassPath } from './grass';

/* ------------------------------------------------------------------ стекло */

export type GlassTone = 'light' | 'idle' | 'dark' | 'gold' | 'danger' | 'aqua' | 'lime';

interface ToneSpec {
  top: string;
  mid: string;
  bottom: string;
  edge: string;
}

const TONES: Record<GlassTone, ToneSpec> = {
  light: {
    top: palette.glassTop,
    mid: palette.glassMid,
    bottom: palette.glassBottom,
    edge: palette.glassEdge,
  },
  idle: {
    top: palette.glassIdleTop,
    mid: palette.glassIdleBreak,
    bottom: palette.glassIdleBottom,
    edge: palette.glassEdge,
  },
  aqua: {
    top: palette.aquaLight,
    mid: palette.aqua,
    bottom: palette.aquaShadow,
    edge: 'rgba(255,255,255,0.85)',
  },
  dark: {
    top: palette.darkGlassTop,
    mid: palette.darkGlassBreak,
    bottom: palette.darkGlassBottom,
    edge: palette.darkGlassEdge,
  },
  lime: {
    top: 'rgba(228,252,168,0.95)',
    mid: 'rgba(169,230,75,0.8)',
    bottom: 'rgba(124,198,35,0.92)',
    edge: palette.glassEdge,
  },
  gold: {
    top: palette.goldGlassTop,
    mid: palette.goldGlassBreak,
    bottom: palette.goldGlassBottom,
    edge: palette.glassEdge,
  },
  danger: {
    top: palette.dangerTop,
    mid: palette.dangerBreak,
    bottom: palette.dangerBottom,
    edge: palette.glassEdge,
  },
};

interface GlassProps {
  tone?: GlassTone;
  radius?: number;
  style?: ViewStyle | ViewStyle[];
  /** Сильная тень — для кнопок и всплывающих панелей. */
  raised?: boolean;
  /** Цветное кольцо вокруг панели: «вы» в таблице, только что взятая ачивка. */
  ring?: string;
  children?: React.ReactNode;
}

/**
 * Стеклянная поверхность: три полосы заливки плюс белая нитка сверху.
 *
 * Тень живёт на внешнем View, а скругление с overflow — на внутреннем:
 * на iOS тень и clip на одном узле конфликтуют.
 */
export function Glass({
  tone = 'light',
  radius = theme.radii.lg,
  style,
  raised,
  ring,
  children,
}: GlassProps) {
  const spec = TONES[tone];

  return (
    <View
      style={[
        raised ? shadows.raised : shadows.panel,
        { borderRadius: radius },
        ring ? { borderWidth: 2, borderColor: ring, borderRadius: radius + 2 } : null,
        style as ViewStyle,
      ]}
    >
      <View
        style={{
          borderRadius: radius,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: spec.edge,
          backgroundColor: spec.bottom,
        }}
      >
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {/* Верхний блик — до стыка. */}
          <View style={{ height: `${glassStops[1] * 100}%`, backgroundColor: spec.top }} />
          {/* Сразу за стыком: та же заливка, но темнее. Ступенька видна. */}
          <View style={{ height: '26%', backgroundColor: spec.mid }} />
        </View>
        <View pointerEvents="none" style={styles.innerHighlight} />
        {children}
      </View>
    </View>
  );
}

/** Круглая стеклянная «капля» — бейдж уровня, аватар, иконка места. */
export function Orb({
  size,
  tone = 'light',
  style,
  children,
}: {
  size: number;
  tone?: GlassTone;
  style?: ViewStyle;
  children?: React.ReactNode;
}) {
  const spec = TONES[tone];

  return (
    <View style={[shadows.panel, { borderRadius: size / 2 }, style]}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: spec.edge,
          backgroundColor: spec.bottom,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={{ height: '46%', backgroundColor: spec.top }} />
          <View style={{ height: '26%', backgroundColor: spec.mid }} />
        </View>
        {children}
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------- небо */

interface Bubble {
  x: number;
  y: number;
  r: number;
  opacity: number;
}

/** Пузыри раскладываются по фиксированной сетке долей — без рандома в рендере. */
const BUBBLE_SPOTS: ReadonlyArray<readonly [number, number, number, number]> = [
  [-0.1, 0.26, 0.23, 0.5],
  [1.05, 0.72, 0.16, 0.42],
  [0.82, 0.12, 0.09, 0.36],
  [0.12, 0.86, 0.12, 0.34],
];

function bubbles(width: number, height: number): Bubble[] {
  return BUBBLE_SPOTS.map(([fx, fy, fr, opacity]) => ({
    x: fx * width,
    y: fy * height,
    r: fr * width,
    opacity,
  }));
}

function BubbleShapes({ items }: { items: Bubble[] }) {
  return (
    <Group>
      {items.map((b, index) => (
        <Circle key={index} cx={b.x} cy={b.y} r={b.r} opacity={b.opacity}>
          <RadialGradient
            c={vec(b.x - b.r * 0.32, b.y - b.r * 0.36)}
            r={b.r * 1.25}
            colors={['rgba(255,255,255,0.75)', 'rgba(191,242,255,0.16)', 'rgba(255,255,255,0.04)']}
            positions={[0, 0.45, 1]}
          />
        </Circle>
      ))}
    </Group>
  );
}

/**
 * Фон экрана: небо с пузырями. Лежит под всем содержимым, жесты не ловит.
 * Один Canvas на экран — дешевле, чем стопка View с полупрозрачностями.
 */
export function SkyBackdrop() {
  const { width, height } = useWindowDimensions();
  const items = useMemo(() => bubbles(width, height), [width, height]);

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(0, height)}
          colors={skyBands as unknown as string[]}
          positions={[0, 0.26, 0.62, 1]}
        />
      </Rect>
      <BubbleShapes items={items} />
    </Canvas>
  );
}

/* ------------------------------------------------------------------ трава */

/**
 * Полоса травы в подвале шапки — линия горизонта «синее небо / зелёный холм».
 * Два слоя: дальний тёмный и ближний светлый, плюс сдвинутая подсветка.
 */
export function GrassStrip({ width, height = theme.grassHeight }: { width: number; height?: number }) {
  const paths = useMemo(() => {
    const back = grassPath({ width, base: height, height: height * 0.82, seed: 7, bladeWidth: 11 });
    const front = grassPath({ width, base: height, height: height * 0.58, seed: 41, bladeWidth: 8 });
    return {
      back: Skia.Path.MakeFromSVGString(back),
      front: Skia.Path.MakeFromSVGString(front),
    };
  }, [width, height]);

  if (!paths.back || !paths.front) return null;

  return (
    <Canvas style={{ width, height }} pointerEvents="none">
      <Path path={paths.back} color={palette.limeDark} opacity={0.75} />
      <Path path={paths.front} color={palette.limeShadow} />
      <Group transform={[{ translateX: 3 }, { translateY: 6 }]}>
        <Path path={paths.front} color={palette.lime} opacity={0.55} />
      </Group>
    </Canvas>
  );
}

/* ----------------------------------------------------------------- шапка */

/**
 * Фон шапки: насыщенное небо, солнечный блик, пузыри и трава по нижнему краю.
 * Размер приходит снаружи — шапка меряется по содержимому, а Skia нужны числа.
 */
export function HeaderBackdrop({ width, height }: { width: number; height: number }) {
  const items = useMemo(
    () => [
      { x: width * 0.08, y: -height * 0.2, r: height * 0.55, opacity: 0.45 },
      { x: width * 0.72, y: height * 0.22, r: height * 0.2, opacity: 0.5 },
    ],
    [width, height],
  );

  if (width <= 0 || height <= 0) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Canvas style={{ width, height }}>
        <Rect x={0} y={0} width={width} height={height}>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(0, height)}
            colors={headerBands as unknown as string[]}
            positions={[0, 0.38, 0.39, 1]}
          />
        </Rect>
        <BubbleShapes items={items} />
      </Canvas>
      <View style={styles.grassAnchor}>
        <GrassStrip width={width} />
      </View>
    </View>
  );
}

/* ----------------------------------------------------------------- капли */

/**
 * Капля на стекле. Живёт только на стеклянных поверхностях: карта не под
 * стеклом, на неё капли не ставим.
 */
export function Droplet({
  size = 13,
  style,
}: {
  size?: number;
  style?: ViewStyle;
}) {
  return (
    <View
      pointerEvents="none"
      style={[
        {
          width: size,
          height: size * 1.22,
          borderTopLeftRadius: size,
          borderTopRightRadius: size,
          borderBottomLeftRadius: size * 0.8,
          borderBottomRightRadius: size * 0.8,
          backgroundColor: 'rgba(255,255,255,0.28)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.55)',
        },
        style,
      ]}
    >
      <View
        style={{
          position: 'absolute',
          top: size * 0.16,
          left: size * 0.22,
          width: size * 0.34,
          height: size * 0.34,
          borderRadius: size,
          backgroundColor: 'rgba(255,255,255,0.9)',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  innerHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  grassAnchor: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
