/**
 * Планета поверх карты на максимальном отдалении.
 *
 * Нативный MapLibre рисует только плоский Меркатор — проекции «глобус»
 * в нём нет (она есть лишь в веб-версии, которой у нас нет). Поэтому
 * шар рисуется нами: при отдалении плоская карта гаснет под непрозрачным
 * слоем, а на нём проявляется Земля, повёрнутая тем же местом, на которое
 * человек смотрел на карте. Отдалил до упора — увидел планету, приблизил —
 * вернулся в свой район.
 *
 * Прозрачность считается воркетом на каждом кадре жеста, а сама геометрия
 * пересобирается только когда карта остановилась: 4700 точек суши на кадр
 * в UI-потоке не нужны никому.
 */

import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import {
  Blur,
  Canvas,
  Circle,
  Group,
  Path,
  RadialGradient,
  Rect,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated';

import type { LngLat } from '@/core/geo/mercator';
import { palette } from '@/core/theme/tokens';
import type { SharedCamera } from '@/features/fog/FogLayer';

import { LAND_RINGS } from './land';
import {
  globeOpacity,
  globeScale,
  graticule,
  projectGlobe,
  ringVisible,
  spaceOpacity,
  type GlobeView,
} from './projection';

/** Доля меньшей стороны экрана, которую занимает диаметр планеты. */
const DISC_RATIO = 0.82;
const STAR_COUNT = 70;

interface Props {
  camera: SharedValue<SharedCamera>;
  /** Куда повёрнут шар — центр карты на момент последней остановки. */
  center: LngLat;
  /** Своя точка: единственная метка, которая имеет смысл в масштабе планеты. */
  me: LngLat | null;
  width: number;
  height: number;
}

export function GlobeOverlay({ camera, center, me, width, height }: Props) {
  // Целое число градусов: при панорамировании карты шар доворачивается
  // заметными шагами, но не пересобирается на каждый пиксель.
  const lng0 = Math.round(center.lng);
  const lat0 = Math.round(center.lat);

  const view = useMemo<GlobeView>(
    () => ({
      cx: width / 2,
      cy: height / 2,
      r: (Math.min(width, height) * DISC_RATIO) / 2,
      lng0,
      lat0,
    }),
    [width, height, lng0, lat0],
  );

  const land = useMemo(() => {
    const path = Skia.Path.Make();
    for (const ring of LAND_RINGS) {
      if (!ringVisible(ring, view)) continue;
      for (let i = 0; i < ring.length; i += 2) {
        const p = projectGlobe(ring[i]!, ring[i + 1]!, view);
        if (i === 0) path.moveTo(p.x, p.y);
        else path.lineTo(p.x, p.y);
      }
      path.close();
    }
    return path;
  }, [view]);

  const grid = useMemo(() => {
    const path = Skia.Path.Make();
    for (const line of graticule(30)) {
      let drawing = false;
      for (let i = 0; i < line.length; i += 2) {
        const p = projectGlobe(line[i]!, line[i + 1]!, view);
        // Линии сетки рвутся на горизонте: прижимать их к краю, как
        // материки, нельзя — получился бы лишний обод по диску.
        if (!p.front) {
          drawing = false;
          continue;
        }
        if (drawing) path.lineTo(p.x, p.y);
        else path.moveTo(p.x, p.y);
        drawing = true;
      }
    }
    return path;
  }, [view]);

  const stars = useMemo(() => buildStars(width, height, view), [width, height, view]);

  const here = useMemo(() => (me ? projectGlobe(me.lng, me.lat, view) : null), [me, view]);

  // Небо появляется первым и к началу проявления шара уже непрозрачно:
  // иначе сквозь материки просвечивают тайлы карты и две картинки
  // накладываются друг на друга.
  const style = useAnimatedStyle(() => ({ opacity: spaceOpacity(camera.value.zoom) }));

  // Шар живёт своей анимацией внутри уже чёрного неба: проявляется
  // и подрастает. Оба значения считаются в UI-потоке каждый кадр.
  const bodyOpacity = useDerivedValue(() => globeOpacity(camera.value.zoom));
  const bodyTransform = useDerivedValue(() => [{ scale: globeScale(camera.value.zoom) }]);

  return (
    <Animated.View style={[styles.wrap, style]} pointerEvents="none">
      <Canvas style={StyleSheet.absoluteFill}>
        {/* Космос кроет плоскую карту целиком — иначе тайлы просвечивали бы
            сквозь океан и вся иллюзия шара рассыпалась. */}
        <Rect x={0} y={0} width={width} height={height} color={palette.ink} />

        {stars.map((star, index) => (
          <Circle
            key={index}
            cx={star.x}
            cy={star.y}
            r={star.r}
            color={palette.parchment}
            opacity={star.opacity}
          />
        ))}

        <Group opacity={bodyOpacity} origin={vec(view.cx, view.cy)} transform={bodyTransform}>
          {/* Атмосфера: размытое кольцо чуть больше диска. */}
          <Group>
            <Blur blur={18} />
            <Circle
              cx={view.cx}
              cy={view.cy}
              r={view.r + 6}
              color={palette.gold}
              style="stroke"
              strokeWidth={10}
              opacity={0.35}
            />
          </Group>

          {/* Океан. Свет падает сверху слева, к краю шар уходит в тень —
              без этого диск читается как наклейка, а не как шар. */}
          <Circle cx={view.cx} cy={view.cy} r={view.r}>
            <RadialGradient
              c={vec(view.cx - view.r * 0.3, view.cy - view.r * 0.35)}
              r={view.r * 1.45}
              colors={[palette.tealBright, palette.teal, palette.fog]}
              positions={[0, 0.55, 1]}
            />
          </Circle>

          <Path path={grid} style="stroke" strokeWidth={0.8} color={palette.parchment} opacity={0.18} />

          <Path path={land} color={palette.ground} opacity={0.95} />
          <Path
            path={land}
            style="stroke"
            strokeWidth={1}
            color={palette.textDark}
            opacity={0.35}
          />

          {/* Затенение края поверх суши: тень должна ложиться и на материки. */}
          <Circle cx={view.cx} cy={view.cy} r={view.r}>
            <RadialGradient
              c={vec(view.cx - view.r * 0.25, view.cy - view.r * 0.3)}
              r={view.r * 1.3}
              colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.7)']}
              positions={[0, 0.6, 1]}
            />
          </Circle>

          {here?.front && (
            <Group>
              <Circle cx={here.x} cy={here.y} r={12} color={palette.ember} opacity={0.35} />
              <Circle cx={here.x} cy={here.y} r={4.5} color={palette.ember} />
            </Group>
          )}
        </Group>
      </Canvas>
    </Animated.View>
  );
}

interface Star {
  x: number;
  y: number;
  r: number;
  opacity: number;
}

/**
 * Звёзды раскладываются детерминированно: случайные при каждом рендере
 * мерцали бы при любом довороте шара.
 */
function buildStars(width: number, height: number, view: GlobeView): Star[] {
  let seed = 20240917;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const stars: Star[] = [];
  let guard = 0;
  while (stars.length < STAR_COUNT && guard < STAR_COUNT * 20) {
    guard += 1;
    const x = random() * width;
    const y = random() * height;
    // За планетой звёзд не видно.
    if (Math.hypot(x - view.cx, y - view.cy) < view.r + 14) continue;
    stars.push({ x, y, r: 0.6 + random() * 1.3, opacity: 0.25 + random() * 0.5 });
  }
  return stars;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
