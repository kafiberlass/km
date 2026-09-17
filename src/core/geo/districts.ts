/**
 * Кварталы — то, что человек закрывает, гуляя.
 *
 * Процент открытия района («3%») ничего не говорит: непонятно, много это
 * или мало, и непонятно, куда идти, чтобы стало больше. Квартал — цель
 * с видимым краем: осталось две улицы, и он закрыт.
 *
 * Квартал — это та же сетка H3, только крупнее: ячейка девятого уровня
 * содержит 49 учётных ячеек одиннадцатого. По земле это примерно 350
 * метров поперёк — квартал-другой застройки, то есть прогулка минут на
 * десять, а не на день.
 */

import { cellToParent, latLngToCell } from 'h3-js';

import { CELL_RES, type Cell } from './coverage';
import type { LngLat } from './mercator';

export const DISTRICT_RES = 9;

/** Сколько учётных ячеек помещается в квартал: 7 на каждый уровень. */
export const CELLS_PER_DISTRICT = 7 ** (CELL_RES - DISTRICT_RES);

/**
 * Доля, при которой квартал считается закрытым.
 *
 * Не единица: сто процентов означало бы зайти в каждый двор, подъезд
 * и газон — коридор раскрытия шириной сто метров покрывает улицу, но
 * не внутренности кварталов. Восемьдесят процентов — это «прошёл все
 * улицы», достижимо и ощущается честно.
 */
export const DISTRICT_DONE_RATIO = 0.8;

export interface DistrictProgress {
  id: Cell;
  opened: number;
  total: number;
  /** 0..1 */
  ratio: number;
  done: boolean;
}

/** Квартал, которому принадлежит учётная ячейка. */
export function districtOf(cell: Cell): Cell {
  return cellToParent(cell, DISTRICT_RES);
}

/**
 * Квартал, в котором находится точка.
 *
 * Считается через учётную ячейку, а не напрямую: сетка H3 не вложена
 * геометрически идеально, и у точки возле границы «свой» квартал может
 * не совпасть с кварталом её же ячейки. Тогда экран показывал бы прогресс
 * одного квартала, а счётчик вёл другой — расхождение на ровном месте.
 */
export function districtAt(point: LngLat): Cell {
  return districtOf(latLngToCell(point.lat, point.lng, CELL_RES));
}

export function progressOf(opened: number, id: Cell): DistrictProgress {
  const ratio = Math.min(1, opened / CELLS_PER_DISTRICT);
  return {
    id,
    opened,
    total: CELLS_PER_DISTRICT,
    ratio,
    done: ratio >= DISTRICT_DONE_RATIO,
  };
}

/** Сколько ячеек открыто в каждом квартале. */
export function countByDistrict(cells: Iterable<Cell>): Map<Cell, number> {
  const counts = new Map<Cell, number>();
  for (const cell of cells) {
    const district = districtOf(cell);
    counts.set(district, (counts.get(district) ?? 0) + 1);
  }
  return counts;
}

/**
 * Кварталы, закрывшиеся именно сейчас.
 *
 * Нужны, чтобы наградить ровно один раз: сравниваем состояние до и после
 * добавления ячеек, а не проверяем «закрыт ли» — иначе награда капала бы
 * на каждом шаге внутри уже закрытого квартала.
 */
export function newlyCompleted(
  before: ReadonlyMap<Cell, number>,
  after: ReadonlyMap<Cell, number>,
): Cell[] {
  const completed: Cell[] = [];

  for (const [district, opened] of after) {
    const wasDone = progressOf(before.get(district) ?? 0, district).done;
    if (!wasDone && progressOf(opened, district).done) completed.push(district);
  }

  return completed;
}

/** Сколько кварталов закрыто целиком. */
export function completedCount(counts: ReadonlyMap<Cell, number>): number {
  let total = 0;
  for (const [district, opened] of counts) {
    if (progressOf(opened, district).done) total += 1;
  }
  return total;
}
