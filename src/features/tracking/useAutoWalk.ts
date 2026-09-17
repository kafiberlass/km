/**
 * Автоматическое начало и конец прогулки.
 *
 * Следит за позицией, пока приложение открыто, и решает по смещению
 * (см. autoWalk.ts), идёт человек или стоит.
 *
 * Честно про границы: это работает, пока приложение на экране или
 * в фоне с выданным разрешением. Определение движения при закрытом
 * приложении — то, за что берут деньги в react-native-background-
 * geolocation: там есть детект остановки и activity recognition
 * на уровне ОС. Бесплатными средствами так не выходит.
 */

import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';

import { decideAutoWalk, type AutoWalkState } from './autoWalk';

/** Замер не чаще, чем раз в 15 секунд и не ближе 25 метров — этого
 *  достаточно для порога в сто метров и не жжёт батарею. */
const WATCH_OPTIONS: Location.LocationOptions = {
  accuracy: Location.Accuracy.Balanced,
  timeInterval: 15_000,
  distanceInterval: 25,
};

export function useAutoWalk(
  enabled: boolean,
  walking: boolean,
  onStart: () => void,
  onStop: () => void,
): void {
  const state = useRef<AutoWalkState | null>(null);

  // Через ref, а не через зависимости эффекта: иначе каждый старт и стоп
  // пересоздавал бы подписку на геолокацию.
  const walkingRef = useRef(walking);
  walkingRef.current = walking;
  const startRef = useRef(onStart);
  startRef.current = onStart;
  const stopRef = useRef(onStop);
  stopRef.current = onStop;

  useEffect(() => {
    if (!enabled) {
      state.current = null;
      return;
    }

    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    void (async () => {
      // Разрешение спрашиваем здесь: человек только что сам включил
      // автоопределение, момент понятный.
      const granted =
        (await Location.getForegroundPermissionsAsync()).granted ||
        (await Location.requestForegroundPermissionsAsync()).granted;

      if (!granted || cancelled) return;

      subscription = await Location.watchPositionAsync(WATCH_OPTIONS, (location) => {
        const point = { lat: location.coords.latitude, lng: location.coords.longitude };
        const decision = decideAutoWalk(
          state.current,
          point,
          location.timestamp,
          walkingRef.current,
        );

        state.current = decision.state;
        if (decision.action === 'start') startRef.current();
        if (decision.action === 'stop') stopRef.current();
      });

      if (cancelled) {
        subscription.remove();
        subscription = null;
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled]);
}
