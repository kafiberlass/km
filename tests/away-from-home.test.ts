import { describe, expect, it } from 'vitest';

import { AWAY_FROM_HOME_M, isAwayFromHome } from '@/features/map/awayFromHome';

const home = { lat: 55.7963, lng: 49.1088 }; // Казань

describe('человек не дома', () => {
  it('прогулка по своему району домом и остаётся', () => {
    expect(isAwayFromHome(home, { lat: 55.8, lng: 49.12 })).toBe(false);
  });

  it('другой город — уже не дом', () => {
    expect(isAwayFromHome(home, { lat: 55.7558, lng: 37.6173 })).toBe(true); // Москва
  });

  it('пока позиция неизвестна, ничего не решаем', () => {
    expect(isAwayFromHome(home, null)).toBe(false);
  });

  it('порог можно задать', () => {
    const nearby = { lat: 55.83, lng: 49.1088 };
    expect(isAwayFromHome(home, nearby, AWAY_FROM_HOME_M)).toBe(false);
    expect(isAwayFromHome(home, nearby, 1000)).toBe(true);
  });
});
