/**
 * Обёртка над MapLibre.
 *
 * Весь остальной код обращается к карте только через этот компонент.
 * Когда/если поменяется провайдер тайлов или сам SDK, переписывается
 * один файл, а не половина фич.
 *
 * Здесь же — мост между камерой карты и Skia-слоем: координаты кладутся
 * в SharedValue, чтобы туман двигался на UI-потоке, не будя React.
 */

import React, { forwardRef, useCallback, useMemo } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import {
  Camera,
  Map,
  type CameraRef,
  type ViewStateChangeEvent,
} from '@maplibre/maplibre-react-native';
import type { NativeSyntheticEvent } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import { palette } from '@/core/theme/tokens';
import type { SharedCamera } from '@/features/fog/FogLayer';
import { buildMapStyle } from './style';

export interface MapCanvasProps {
  camera: SharedValue<SharedCamera>;
  initialCenter: [number, number];
  initialZoom?: number;
  onLayoutSize?: (size: { width: number; height: number }) => void;
  /** Вызывается, когда жест закончился — момент для тяжёлой пересборки. */
  onIdle?: (state: ViewStateChangeEvent) => void;
  children?: React.ReactNode;
}

export const MapCanvas = forwardRef<CameraRef, MapCanvasProps>(function MapCanvas(
  { camera, initialCenter, initialZoom = 15, onLayoutSize, onIdle, children },
  ref,
) {
  const mapStyle = useMemo(() => buildMapStyle(), []);

  const syncCamera = useCallback(
    (event: NativeSyntheticEvent<ViewStateChangeEvent>) => {
      const { center, zoom, bearing } = event.nativeEvent;
      // Прямая запись в SharedValue: setState здесь дал бы ре-рендер
      // на каждое движение пальца.
      camera.value = { lng: center[0], lat: center[1], zoom, bearing };
    },
    [camera],
  );

  const handleIdle = useCallback(
    (event: NativeSyntheticEvent<ViewStateChangeEvent>) => {
      syncCamera(event);
      onIdle?.(event.nativeEvent);
    },
    [onIdle, syncCamera],
  );

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      onLayoutSize?.({ width, height });
    },
    [onLayoutSize],
  );

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={mapStyle}
        // Питч выключен: Skia-слой тумана работает с плоской 2D-матрицей,
        // перспектива его сломает. В макете карта тоже плоская.
        touchPitch={false}
        logo={false}
        compass={false}
        scaleBar={false}
        attribution
        attributionPosition={{ bottom: 8, right: 8 }}
        tintColor={palette.parchment}
        onRegionWillChange={syncCamera}
        onRegionIsChanging={syncCamera}
        onRegionDidChange={handleIdle}
      >
        <Camera
          ref={ref}
          initialViewState={{ center: initialCenter, zoom: initialZoom }}
          minZoom={10}
          maxZoom={18}
          pitch={0}
        />
        {children}
      </Map>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.fog },
});
