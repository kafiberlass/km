import { describe, expect, it } from 'vitest';

import {
  AUTO_START_DISTANCE_M,
  AUTO_START_WINDOW_MS,
  AUTO_STOP_IDLE_MS,
  decideAutoWalk,
  isIdleTooLong,
  pointsSince,
  type AutoWalkState,
} from '@/features/tracking/autoWalk';

const HOME = { lat: 55.7963, lng: 49.1088 };

/** Смещение на север на заданное число метров. */
function north(meters: number) {
  return { lat: HOME.lat + meters / 111_320, lng: HOME.lng };
}

function first(now = 0): AutoWalkState {
  return decideAutoWalk(null, HOME, now, false).state;
}

describe('автостарт прогулки', () => {
  it('первый замер только ставит якорь', () => {
    expect(decideAutoWalk(null, HOME, 0, false).action).toBeNull();
  });

  it('молчит, пока человек дома', () => {
    const state = first();
    // Дрожание приёмника у окна: десятки метров туда-сюда.
    const decision = decideAutoWalk(state, north(30), 60_000, false);
    expect(decision.action).toBeNull();
  });

  it('начинает прогулку, когда человек ушёл достаточно далеко', () => {
    const state = first();
    const decision = decideAutoWalk(state, north(AUTO_START_DISTANCE_M + 5), 90_000, false);
    expect(decision.action).toBe('start');
  });

  it('не считает прогулкой медленное расползание за часы', () => {
    // Те же сто метров, но за время, вдвое большее окна: так набегает
    // дрейф координат за день дома, а не выход на улицу.
    const state = first();
    const decision = decideAutoWalk(
      state,
      north(AUTO_START_DISTANCE_M + 5),
      AUTO_START_WINDOW_MS * 2,
      false,
    );
    expect(decision.action).toBeNull();
    // Якорь переехал: считаем заново отсюда.
    expect(decision.state.anchorAt).toBe(AUTO_START_WINDOW_MS * 2);
  });

  it('после переноса якоря новый уход всё равно засчитывается', () => {
    const stale = decideAutoWalk(first(), north(10), AUTO_START_WINDOW_MS * 2, false).state;
    const decision = decideAutoWalk(
      stale,
      { lat: stale.anchor.lat + (AUTO_START_DISTANCE_M + 5) / 111_320, lng: stale.anchor.lng },
      AUTO_START_WINDOW_MS * 2 + 60_000,
      false,
    );
    expect(decision.action).toBe('start');
  });
});

describe('автостоп прогулки', () => {
  it('во время ходьбы не останавливает', () => {
    let state = first();
    for (let minute = 1; minute <= 10; minute += 1) {
      const decision = decideAutoWalk(state, north(80 * minute), minute * 60_000, true);
      expect(decision.action).toBeNull();
      state = decision.state;
    }
  });

  it('останавливает после долгого простоя', () => {
    const state = first();
    const decision = decideAutoWalk(state, north(5), AUTO_STOP_IDLE_MS, true);
    expect(decision.action).toBe('stop');
  });

  it('короткая остановка на светофоре прогулку не завершает', () => {
    const state = first();
    const decision = decideAutoWalk(state, north(5), 90_000, true);
    expect(decision.action).toBeNull();
  });
});

describe('конец прогулки без единой точки', () => {
  // Человек сел в кафе: трекер молчит вместе с ним, и решать приходится
  // по времени последнего движения, а не по потоку точек.
  const lastMove = 1_700_000_000_000;

  it('шесть минут без движения — прогулка закончилась', () => {
    expect(isIdleTooLong(lastMove, lastMove + AUTO_STOP_IDLE_MS)).toBe(true);
    expect(isIdleTooLong(lastMove, lastMove + AUTO_STOP_IDLE_MS - 1)).toBe(false);
  });

  it('только что открытая прогулка не закрывается сама', () => {
    expect(isIdleTooLong(0, lastMove + 10 * AUTO_STOP_IDLE_MS)).toBe(false);
  });
});

describe('добор пути от якоря', () => {
  const buffer = [{ timestamp: 10 }, { timestamp: 20 }, { timestamp: 30 }];

  it('берёт точки с момента якоря, включая его собственную', () => {
    expect(pointsSince(buffer, 20)).toEqual([{ timestamp: 20 }, { timestamp: 30 }]);
  });

  it('якорь раньше буфера — берём всё, что помним', () => {
    expect(pointsSince(buffer, 0)).toHaveLength(3);
  });

  it('якорь позже последней точки — брать нечего', () => {
    expect(pointsSince(buffer, 999)).toEqual([]);
  });
});
