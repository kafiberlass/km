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
import { StyleSheet, View } from 'react-native';
import {
  Blur,
  Canvas,
  Circle,
  Group,
  Path,
  RadialGradient,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import type { LngLat } from '@/core/geo/mercator';
import { palette } from '@/core/theme/tokens';
import type { SharedCamera } from '@/features/fog/FogLayer';
import { isFresh, type Friend } from '@/features/friends/types';
import { Avatar } from '@/features/profile/Avatar';

import { LAND_UNITS } from './landUnits';
import {
  GLOBE_ZOOM_NONE,
  globeMarkers,
  globeOpacity,
  globeScale,
  globeTrig,
  graticule,
  projectGlobe,
  projectUnit,
  globeBackdropRadius,
  skyRadius,
  spaceOpacity,
  spreadMarkers,
  type GlobeView,
} from './projection';

/** Доля меньшей стороны экрана, которую занимает диаметр планеты. */
const DISC_RATIO = 0.82;
const STAR_COUNT = 70;

/**
 * На сколько пикселей разводятся метки, попавшие в одну точку.
 *
 * Один градус на шаре — меньше двух пикселей, а люди в одном городе
 * отстоят на сотые доли градуса: без разведения метка друга оказывается
 * ровно под своей, и видно только одну.
 */
const MARKER_GAP = 26;

/** Размер лица на планете. Больше — и два друга в одном городе слипнутся. */
const FACE = 24;

/** Какую долю пути до настоящего зума сглаженный проходит за кадр. */
const SMOOTHING = 0.33;

interface Props {
  camera: SharedValue<SharedCamera>;
  /** Куда повёрнут шар — центр карты на момент последней остановки. */
  center: LngLat;
  /** Своя точка. */
  me: LngLat | null;
  /** Друзья с известной позицией — на шаре видно, кто где на Земле. */
  friends: readonly Friend[];
  /** Своя аватарка и имя: на планете тоже должно быть видно, кто это. */
  myAvatar?: string | null;
  myName?: string | null;
  width: number;
  height: number;
}

export function GlobeOverlay({
  camera,
  center,
  me,
  friends,
  width,
  height,
  myAvatar = null,
  myName = null,
}: Props) {
  // Шаг доворота задаёт MapStack — он же решает, когда будить React.
  // Округлять здесь второй раз нельзя: полуградусные шаги превратились бы
  // обратно в целые, то есть ровно в те ступеньки, от которых уходили.
  const lng0 = center.lng;
  const lat0 = center.lat;

  // Диск отдельно от ориентации: при повороте планеты он не меняется,
  // и всё, что зависит только от него (звёзды), пересобирать незачем.
  /**
   * До какого радиуса растить небо: половина диагонали, чтобы круг
   * накрыл и углы экрана.
   */
  const coverRadius = useMemo(() => Math.hypot(width, height) / 2, [width, height]);

  const disc = useMemo(
    () => ({
      cx: width / 2,
      cy: height / 2,
      r: (Math.min(width, height) * DISC_RATIO) / 2,
    }),
    [width, height],
  );

  const view = useMemo<GlobeView>(() => ({ ...disc, lng0, lat0 }), [disc, lng0, lat0]);

  const land = useMemo(() => {
    const path = Skia.Path.Make();
    // Синусы поворота считаются один раз на всю сушу, а сами точки
    // лежат готовыми векторами: на кадр остаётся умножение.
    const trig = globeTrig(view);

    for (const ring of LAND_UNITS) {
      // Один проход на кольцо, а не два. Раньше видимость проверялась
      // отдельным проходом через ringVisible, и вся суша проецировалась
      // дважды — при повороте планеты это ощутимо: 4700 точек на градус.
      let front = false;
      const xs: number[] = [];
      const ys: number[] = [];

      for (let i = 0; i < ring.length; i += 3) {
        const projected = projectUnit(ring[i]!, ring[i + 1]!, ring[i + 2]!, trig, view);
        if (projected.front) front = true;
        xs.push(projected.x);
        ys.push(projected.y);
      }

      if (!front) continue;

      path.moveTo(xs[0]!, ys[0]!);
      for (let i = 1; i < xs.length; i += 1) path.lineTo(xs[i]!, ys[i]!);
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

  const stars = useMemo(() => buildStars(width, height, disc), [width, height, disc]);

  /**
   * Люди на шаре: своя метка и друзья в одном списке — иначе их не развести
   * между собой, а на планете все они оказываются в одной точке.
   */
  const pins = useMemo(() => {
    const source: {
      key: string;
      color: string;
      live: boolean;
      self: boolean;
      at: LngLat;
      avatar: string | null;
      name: string;
    }[] = [];

    if (me) {
      source.push({
        key: 'me',
        color: palette.ember,
        live: true,
        self: true,
        at: me,
        avatar: myAvatar,
        name: myName ?? 'Я',
      });
    }

    for (const friend of friends) {
      if (!friend.position) continue;
      source.push({
        key: friend.id,
        color: friend.color,
        // Несвежая позиция гаснет — та же условность, что и на карте:
        // «был здесь», а не «сейчас здесь».
        live: isFresh(friend.position),
        self: false,
        at: friend.position,
        avatar: friend.avatar,
        name: friend.name,
      });
    }

    // Друзья на обратной стороне Земли отсеиваются до разведения: иначе
    // они растащили бы кучку, в которой их нет.
    const visible = globeMarkers(source, view, (item) => item.at);
    return spreadMarkers(
      visible.map(({ item, x, y }) => ({ ...item, x, y })),
      MARKER_GAP,
    );
  }, [me, friends, view, myAvatar, myName]);

  /**
   * Сглаженный зум — только для анимации перехода.
   *
   * Карта сообщает своё положение событиями, и приходят они неровно:
   * то несколько за кадр, то ни одного, а на инерции после броска пальцем
   * шаг между ними скачет. Привязанная к ним напрямую прозрачность
   * дёргается вместе с ними. Здесь значение догоняет настоящий зум на
   * каждом кадре — каждый раз на треть оставшегося расстояния, — и любая
   * рваность превращается в ровное движение. Плата — около трёх кадров
   * задержки, которых глаз не замечает.
   *
   * Туман и метки этим не пользуются намеренно: им положено совпадать
   * с картой пиксель в пиксель, и отставание там было бы враньём.
   */
  const smoothZoom = useSharedValue(camera.value.zoom);

  useFrameCallback(() => {
    'worklet';
    const target = camera.value.zoom;
    const next = smoothZoom.value + (target - smoothZoom.value) * SMOOTHING;
    smoothZoom.value = Math.abs(target - next) < 0.001 ? target : next;
  });

  /*
    Канвас виден всё время, пока смонтирован: гасить его целиком нельзя,
    иначе вместе с небом исчезает и шар. Прозрачностью управляет то, что
    нарисовано внутри.
  */
  const style = useAnimatedStyle(() => ({ opacity: smoothZoom.value < GLOBE_ZOOM_NONE ? 1 : 0 }));

  // Круг неба растёт из середины экрана. Вокруг него всё это время
  // видна карта — ради этого всё и затевалось.
  const skyR = useDerivedValue(() => skyRadius(smoothZoom.value, coverRadius));
  const backdropR = useDerivedValue(() => globeBackdropRadius(smoothZoom.value, view.r));
  const starsOpacity = useDerivedValue(() => spaceOpacity(smoothZoom.value));

  // Шар живёт своей анимацией внутри уже чёрного неба: проявляется
  // и подрастает. Оба значения считаются в UI-потоке каждый кадр.
  const bodyOpacity = useDerivedValue(() => globeOpacity(smoothZoom.value));
  const bodyTransform = useDerivedValue(() => [{ scale: globeScale(smoothZoom.value) }]);

  // Лица живут вне канваса, но подчиняются той же анимации.
  const faceStyle = useAnimatedStyle(() => ({
    opacity: globeOpacity(smoothZoom.value),
    transform: [{ scale: globeScale(smoothZoom.value) }],
  }));

  return (
    <Animated.View style={[styles.wrap, style]} pointerEvents="none">
      <Canvas style={StyleSheet.absoluteFill}>
        {/* Подложка под планетой проявляется вместе с ней: пока шар
            полупрозрачен, сквозь него не видно карту, а пока шара нет —
            нет и тёмного пятна. */}
        <Group opacity={bodyOpacity}>
          <Circle cx={view.cx} cy={view.cy} r={backdropR} color={palette.fog} />
        </Group>

        {/* А это космос вокруг планеты: растёт кругом из середины, и пока
            он мал, по краям экрана видна карта. */}
        <Circle cx={view.cx} cy={view.cy} r={skyR} color={palette.fog} />

        <Group opacity={starsOpacity}>
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
        </Group>

        <Group opacity={bodyOpacity} origin={vec(view.cx, view.cy)} transform={bodyTransform}>
          {/* Атмосфера: размытое кольцо чуть больше диска. */}
          <Group>
            <Blur blur={18} />
            <Circle
              cx={view.cx}
              cy={view.cy}
              r={view.r + 6}
              color={palette.tealBright}
              style="stroke"
              strokeWidth={12}
              opacity={0.45}
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

        </Group>
      </Canvas>

      {/*
        Лица — обычными View поверх канваса, а не внутри него: Skia рисует
        фигуры, а аватарка это картинка из сети или буквы шрифтом.

        Слой масштабируется и гаснет теми же значениями, что и сам шар,
        поэтому лица держатся своих точек на всех этапах перехода.
        Масштаб View считается от центра, а центр слоя совпадает с центром
        планеты, — иначе лица разъехались бы при подлёте.
      */}
      <Animated.View style={[StyleSheet.absoluteFill, faceStyle]} pointerEvents="none">
        {pins.map((pin) => (
          <View
            key={pin.key}
            style={[
              styles.face,
              {
                left: pin.x - FACE / 2,
                top: pin.y - FACE / 2,
                borderColor: pin.color,
                opacity: pin.live ? 1 : 0.45,
              },
            ]}
          >
            <Avatar value={pin.avatar} size={FACE - 4} name={pin.name} />
          </View>
        ))}
      </Animated.View>
    </Animated.View>
  );
}

/** Круг планеты на экране — без привязки к тому, каким боком она повёрнута. */
interface Disc {
  cx: number;
  cy: number;
  r: number;
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
function buildStars(width: number, height: number, disc: Disc): Star[] {
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
    if (Math.hypot(x - disc.cx, y - disc.cy) < disc.r + 14) continue;
    stars.push({ x, y, r: 0.6 + random() * 1.3, opacity: 0.25 + random() * 0.5 });
  }
  return stars;
}

const styles = StyleSheet.create({
  face: {
    position: 'absolute',
    width: FACE,
    height: FACE,
    borderRadius: FACE / 2,
    borderWidth: 2,
    overflow: 'hidden',
    backgroundColor: palette.fog,
  },
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
