import { describe, expect, it } from 'vitest';

import { parseMapTarget } from '@/features/map/target';

describe('точка из параметров маршрута', () => {
  it('разбирает нормальные координаты', () => {
    expect(parseMapTarget('37.62', '55.75')).toEqual({ lng: 37.62, lat: 55.75 });
  });

  it('отрицательные и нулевые координаты — тоже координаты', () => {
    expect(parseMapTarget('-0.12', '0')).toEqual({ lng: -0.12, lat: 0 });
  });

  it('без параметров — никуда не ведём', () => {
    expect(parseMapTarget(undefined, undefined)).toBeNull();
    expect(parseMapTarget('37.62', undefined)).toBeNull();
    expect(parseMapTarget('', '')).toBeNull();
  });

  it('мусор не двигает камеру', () => {
    expect(parseMapTarget('undefined', 'null')).toBeNull();
    expect(parseMapTarget('где-то', 'там')).toBeNull();
    expect(parseMapTarget('NaN', '55.7')).toBeNull();
  });

  it('координаты за пределами мира отбрасываются', () => {
    expect(parseMapTarget('181', '55.7')).toBeNull();
    expect(parseMapTarget('37.6', '91')).toBeNull();
  });
});
