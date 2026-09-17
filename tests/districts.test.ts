import { describe, expect, it } from 'vitest';

import { cellsAround, CELL_RES } from '@/core/geo/coverage';
import {
  CELLS_PER_DISTRICT,
  DISTRICT_DONE_RATIO,
  completedCount,
  countByDistrict,
  districtAt,
  districtOf,
  newlyCompleted,
  progressOf,
} from '@/core/geo/districts';
import { latLngToCell } from 'h3-js';

const KAZAN = { lat: 55.7963, lng: 49.1088 };

describe('кварталы', () => {
  it('квартал вмещает 49 учётных ячеек', () => {
    expect(CELLS_PER_DISTRICT).toBe(49);
  });

  it('квартал точки и квартал её ячейки совпадают', () => {
    // Сетка H3 вложена не идеально: у точки возле границы квартал, взятый
    // напрямую, может отличаться от квартала её учётной ячейки. Считаем
    // всегда через ячейку — иначе экран и счётчик разойдутся.
    for (const point of [
      KAZAN,
      { lat: 55.7963, lng: 49.109 },
      { lat: 55.8001, lng: 49.1123 },
      { lat: 55.79, lng: 49.1 },
    ]) {
      const cell = latLngToCell(point.lat, point.lng, CELL_RES);
      expect(districtAt(point)).toBe(districtOf(cell));
    }
  });

  it('прогулка по кварталу раскрывает его частично, а не целиком', () => {
    // Раскрытие радиусом 50 метров вокруг точки — это пятно, а не квартал.
    const cells = cellsAround(KAZAN, 50, CELL_RES);
    const counts = countByDistrict(cells);
    const home = counts.get(districtAt(KAZAN)) ?? 0;

    expect(home).toBeGreaterThan(0);
    expect(home).toBeLessThan(CELLS_PER_DISTRICT);
  });

  it('закрытым считается квартал, пройденный по улицам, а не по дворам', () => {
    expect(progressOf(Math.ceil(CELLS_PER_DISTRICT * DISTRICT_DONE_RATIO), 'x').done).toBe(true);
    expect(progressOf(Math.floor(CELLS_PER_DISTRICT * 0.5), 'x').done).toBe(false);
  });

  it('доля не превышает единицу, даже если ячеек насчиталось больше', () => {
    expect(progressOf(CELLS_PER_DISTRICT * 2, 'x').ratio).toBe(1);
  });
});

describe('момент закрытия квартала', () => {
  const almost = Math.ceil(CELLS_PER_DISTRICT * DISTRICT_DONE_RATIO) - 1;
  const enough = Math.ceil(CELLS_PER_DISTRICT * DISTRICT_DONE_RATIO);

  it('срабатывает один раз — на переходе через порог', () => {
    const before = new Map([['a', almost]]);
    const after = new Map([['a', enough]]);
    expect(newlyCompleted(before, after)).toEqual(['a']);
  });

  it('не повторяется, пока человек ходит по уже закрытому кварталу', () => {
    const before = new Map([['a', enough]]);
    const after = new Map([['a', enough + 5]]);
    expect(newlyCompleted(before, after)).toEqual([]);
  });

  it('замечает несколько кварталов сразу', () => {
    const before = new Map([
      ['a', almost],
      ['b', almost],
    ]);
    const after = new Map([
      ['a', enough],
      ['b', enough],
    ]);
    expect(newlyCompleted(before, after).sort()).toEqual(['a', 'b']);
  });

  it('квартал, открытый с нуля до порога, тоже считается', () => {
    expect(newlyCompleted(new Map(), new Map([['a', enough]]))).toEqual(['a']);
  });
});

describe('счёт закрытых кварталов', () => {
  it('считает только перешагнувшие порог', () => {
    const counts = new Map([
      ['a', CELLS_PER_DISTRICT],
      ['b', Math.ceil(CELLS_PER_DISTRICT * DISTRICT_DONE_RATIO)],
      ['c', 3],
    ]);
    expect(completedCount(counts)).toBe(2);
  });
});
