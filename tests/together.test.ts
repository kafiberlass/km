import { describe, expect, it } from 'vitest';

import { TOGETHER_RADIUS_M, splitByDistance, togetherLabel } from '@/features/map/together';

const me = { lat: 55.7963, lng: 49.1088 };

/** Точка в заданных метрах к северу — широта считается просто. */
function north(meters: number) {
  return { lat: me.lat + meters / 111_320, lng: me.lng };
}

describe('кто рядом', () => {
  it('человек в том же дворе — вместе', () => {
    const { together, apart } = splitByDistance(me, [north(20)], (p) => p);
    expect(together).toHaveLength(1);
    expect(apart).toHaveLength(0);
  });

  it('человек за квартал — отдельно', () => {
    const { together, apart } = splitByDistance(me, [north(400)], (p) => p);
    expect(together).toHaveLength(0);
    expect(apart).toHaveLength(1);
  });

  it('граница считается своей', () => {
    const { together } = splitByDistance(me, [north(TOGETHER_RADIUS_M - 1)], (p) => p);
    expect(together).toHaveLength(1);
  });

  it('без позиции человек не попадает никуда', () => {
    const { together, apart } = splitByDistance(me, [{ p: null }], (person) => person.p);
    expect(together).toHaveLength(0);
    expect(apart).toHaveLength(0);
  });

  it('радиус можно задать', () => {
    const far = [north(150)];
    expect(splitByDistance(me, far, (p) => p).together).toHaveLength(0);
    expect(splitByDistance(me, far, (p) => p, 200).together).toHaveLength(1);
  });
});

describe('подпись под группой', () => {
  it('называет по имени, пока имён немного', () => {
    expect(togetherLabel(['Лена'])).toBe('ВМЕСТЕ: ЛЕНА');
    expect(togetherLabel(['Лена', 'Марк'])).toBe('ВМЕСТЕ: ЛЕНА, МАРК');
  });

  it('имя не склоняется: чужое имя коверкать нельзя', () => {
    // «Вместе с Айгуль» и «вместе с Николаем» требуют разных окончаний,
    // и угадать их по строке невозможно.
    for (const name of ['Айгуль', 'Николай', 'Ким', 'Люся']) {
      expect(togetherLabel([name])).toBe(`ВМЕСТЕ: ${name.toUpperCase()}`);
    }
  });

  it('на толпе считает головы, а не перечисляет', () => {
    expect(togetherLabel(['А', 'Б', 'В'])).toBe('ВМЕСТЕ · РЯДОМ 3');
  });

  it('пустой список — пустая подпись', () => {
    expect(togetherLabel([])).toBe('');
  });
});
