import { describe, expect, it } from 'vitest';

import { STRIDE_M, formatSteps, stepsFromMeters } from '@/core/rules/steps';

describe('шаги по расстоянию', () => {
  it('километр — примерно тысяча четыреста шагов', () => {
    const steps = stepsFromMeters(1000);
    expect(steps).toBeGreaterThan(1300);
    expect(steps).toBeLessThan(1500);
  });

  it('округляются до десятков — точности всё равно нет', () => {
    expect(stepsFromMeters(1000) % 10).toBe(0);
    expect(stepsFromMeters(5432) % 10).toBe(0);
  });

  it('но короткая прогулка не превращается в ноль', () => {
    expect(stepsFromMeters(10)).toBe(14);
    expect(stepsFromMeters(1)).toBe(1);
  });

  it('растут вместе с расстоянием', () => {
    let previous = -1;
    for (const meters of [0, 100, 500, 1000, 10_000]) {
      const steps = stepsFromMeters(meters);
      expect(steps).toBeGreaterThan(previous);
      previous = steps;
    }
  });

  it('длина шага учитывается', () => {
    expect(stepsFromMeters(1000, 1)).toBeLessThan(stepsFromMeters(1000, 0.5));
    expect(stepsFromMeters(1000, STRIDE_M)).toBe(stepsFromMeters(1000));
  });

  it('мусор на входе не даёт мусора на выходе', () => {
    for (const bad of [0, -100, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(stepsFromMeters(bad)).toBe(0);
    }
    expect(stepsFromMeters(1000, 0)).toBe(0);
    expect(stepsFromMeters(1000, -1)).toBe(0);
  });
});

describe('запись числа шагов', () => {
  it('разряды разделены неразрывным пробелом', () => {
    expect(formatSteps(12480)).toBe('12 480');
    expect(formatSteps(999)).toBe('999');
    expect(formatSteps(1000)).toBe('1 000');
    expect(formatSteps(1234567)).toBe('1 234 567');
  });

  it('ноль и отрицательные не ломают строку', () => {
    expect(formatSteps(0)).toBe('0');
    expect(formatSteps(-5)).toBe('0');
  });
});
