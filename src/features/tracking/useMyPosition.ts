/**
 * Своя позиция для карты.
 *
 * Два режима намеренно разные:
 *
 *  - при открытии экрана берём последнюю известную системе точку и не
 *    трогаем GPS: включать приёмник ради метки, которую человек не
 *    просил, — неоправданный расход;
 *  - по нажатию кнопки «к себе» спрашиваем свежую и, если надо,
 *    разрешение: человек сам попросил показать, где он.
 */

import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';

import type { LngLat } from '@/core/geo/mercator';

function toPoint(location: Location.LocationObject): LngLat {
  return { lat: location.coords.latitude, lng: location.coords.longitude };
}

export interface MyPosition {
  /** Последняя известная точка, null — пока ничего не знаем. */
  point: LngLat | null;
  /** Спросить свежую. Вернёт null, если разрешение не дали. */
  locate: () => Promise<LngLat | null>;
}

export function useMyPosition(): MyPosition {
  const [point, setPoint] = useState<LngLat | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (!permission.granted) return;

        const last = await Location.getLastKnownPositionAsync();
        if (last && !cancelled) setPoint(toPoint(last));
      } catch (error) {
        console.warn('[tracking] последняя позиция недоступна', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const locate = useCallback(async (): Promise<LngLat | null> => {
    try {
      const granted =
        (await Location.getForegroundPermissionsAsync()).granted ||
        (await Location.requestForegroundPermissionsAsync()).granted;

      if (!granted) return null;

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const next = toPoint(current);
      setPoint(next);
      return next;
    } catch (error) {
      console.warn('[tracking] не удалось определить позицию', error);
      return null;
    }
  }, []);

  return { point, locate };
}
