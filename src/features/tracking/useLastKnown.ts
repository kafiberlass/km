/**
 * Последняя известная позиция устройства.
 *
 * Нужна, чтобы показать метку «я», когда прогулка не запущена. Берётся
 * именно последняя известная, а не свежий замер: включать GPS ради точки
 * на карте, которую человек даже не просил, — неоправданный расход.
 *
 * Разрешение здесь не запрашивается намеренно. Его спрашивает старт
 * прогулки, где понятно зачем; до этого молча обходимся тем, что есть.
 */

import { useEffect, useState } from 'react';
import * as Location from 'expo-location';

import type { LngLat } from '@/core/geo/mercator';

export function useLastKnownPosition(): LngLat | null {
  const [point, setPoint] = useState<LngLat | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (!permission.granted) return;

        const last = await Location.getLastKnownPositionAsync();
        if (!last || cancelled) return;

        setPoint({ lat: last.coords.latitude, lng: last.coords.longitude });
      } catch (error) {
        console.warn('[tracking] последняя позиция недоступна', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return point;
}
