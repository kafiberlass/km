import { describe, expect, it } from 'vitest';

import { DEMO_CENTER, DEMO_FAR_M, demoPlacesFit } from '../src/features/places/demo';

const MOSCOW = { lng: DEMO_CENTER[0], lat: DEMO_CENTER[1] };
const KAZAN = { lng: 49.1221, lat: 55.7887 };
const HIMKI = { lng: 37.4453, lat: 55.8892 };

describe('демо-места', () => {
  it('пока дом неизвестен — показываем: иначе карта пустая', () => {
    expect(demoPlacesFit(null)).toBe(true);
  });

  it('рядом с Чистыми прудами уместны', () => {
    expect(demoPlacesFit(MOSCOW)).toBe(true);
  });

  it('в пределах Москвы с областью тоже', () => {
    // Из Химок до Чистых прудов доехать не абсурд.
    expect(demoPlacesFit(HIMKI)).toBe(true);
  });

  it('в Казани — нет', () => {
    // Ровно та жалоба, из-за которой правило и появилось: человек живёт
    // в Казани, а на карте кофейня на Мясницкой.
    expect(demoPlacesFit(KAZAN)).toBe(false);
  });

  it('порог — полсотни километров', () => {
    expect(DEMO_FAR_M).toBe(50_000);
  });
});
