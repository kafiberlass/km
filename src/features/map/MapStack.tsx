/**
 * Стопка слоёв карты целиком: тайлы -> туман -> метки -> планета.
 *
 * Экранов с картой теперь два — карточка на главном и полноэкранный
 * режим, — и порядок слоёв у них обязан совпадать. Если развести его
 * по двум файлам, через неделю в одном месте друзья окажутся под туманом,
 * а в другом над ним. HUD у экранов свой и приходит через children.
 */

import React, { forwardRef, useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { runOnJS, useAnimatedReaction, type SharedValue } from 'react-native-reanimated';
import type { CameraRef, ViewStateChangeEvent } from '@maplibre/maplibre-react-native';

import type { LngLat } from '@/core/geo/mercator';
import { FogLayer, type SharedCamera } from '@/features/fog/FogLayer';
import { useFogEnabled } from '@/features/fog/fogSetting';
import type { FogGeometry } from '@/features/fog/geometry';
import type { Friend } from '@/features/friends/types';
import { FriendsLayer } from '@/features/friends/FriendsLayer';
import { GlobeOverlay } from '@/features/globe/GlobeOverlay';
import { GLOBE_ZOOM_NONE } from '@/features/globe/projection';

import { MapCanvas } from './MapCanvas';
import { SelfMarker } from './SelfMarker';

/**
 * Запас над порогом появления планеты, на котором канвас глобуса уже
 * смонтирован. Прозрачность считается в UI-потоке каждый кадр, а сам
 * канвас появляется заранее — иначе шар возникал бы рывком в конце жеста.
 */
const MOUNT_MARGIN = 0.8;

interface Props {
  camera: SharedValue<SharedCamera>;
  origin: LngLat;
  geometry: FogGeometry | null;
  /** Где человек сейчас — метка «я» и точка на планете. */
  myPoint: LngLat;
  tracking: boolean;
  /** Пустой массив = друзья скрыты. */
  friends: readonly Friend[];
  initialZoom?: number;
  onIdle?: (state: ViewStateChangeEvent) => void;
  /** HUD экрана: кнопки, чипы, тосты. */
  children?: React.ReactNode;
}

export const MapStack = forwardRef<CameraRef, Props>(function MapStack(
  { camera, origin, geometry, myPoint, tracking, friends, initialZoom, onIdle, children },
  ref,
) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const fogEnabled = useFogEnabled();
  const [globeNear, setGlobeNear] = useState(false);
  const [globeCenter, setGlobeCenter] = useState<LngLat>(origin);

  useAnimatedReaction(
    () => camera.value.zoom < GLOBE_ZOOM_NONE + MOUNT_MARGIN,
    (near, previous) => {
      if (near !== previous) runOnJS(setGlobeNear)(near);
    },
    [],
  );

  const handleIdle = useCallback(
    (state: ViewStateChangeEvent) => {
      // Шар доворачивается только когда планета видна или вот-вот появится:
      // на городских масштабах это лишний ре-рендер на каждое движение карты.
      if (state.zoom < GLOBE_ZOOM_NONE + MOUNT_MARGIN) {
        const [lng, lat] = state.center;
        setGlobeCenter((current) =>
          Math.abs(current.lng - lng) < 1 && Math.abs(current.lat - lat) < 1
            ? current
            : { lng, lat },
        );
      }
      onIdle?.(state);
    },
    [onIdle],
  );

  const ready = size.width > 0;

  return (
    <>
      <MapCanvas
        ref={ref}
        camera={camera}
        initialCenter={[origin.lng, origin.lat]}
        initialZoom={initialZoom}
        onLayoutSize={setSize}
        onIdle={handleIdle}
      />

      {ready && (
        <FogLayer
          enabled={fogEnabled}
          geometry={geometry}
          origin={origin}
          camera={camera}
          width={size.width}
          height={size.height}
        />
      )}

      {ready && (
        <SelfMarker
          point={myPoint}
          origin={origin}
          camera={camera}
          width={size.width}
          height={size.height}
          active={tracking}
        />
      )}

      {/* Друзья рисуются НАД туманом: иначе метка исчезает ровно там,
          где ты ещё не гулял, — то есть почти везде. */}
      {ready && friends.length > 0 && (
        <FriendsLayer
          friends={friends}
          origin={origin}
          camera={camera}
          width={size.width}
          height={size.height}
        />
      )}

      {/* Планета кроет собой всё, включая туман и метки: с орбиты
          тумана не видно. Своя точка на шаре остаётся. */}
      {ready && globeNear && (
        <GlobeOverlay
          camera={camera}
          center={globeCenter}
          me={myPoint}
          width={size.width}
          height={size.height}
        />
      )}

      <View style={styles.hud} pointerEvents="box-none">
        {children}
      </View>
    </>
  );
});

const styles = StyleSheet.create({
  hud: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
