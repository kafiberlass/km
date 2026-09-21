import { describe, expect, it } from 'vitest';

import { RETRY_AFTER_MS, isOsmPlace, shouldAutoSearch } from '@/features/places/autoFetch';

const NOW = 1_780_000_000_000;

const base = {
  hasOrigin: true,
  landmarks: 0,
  osmPlaces: 0,
  lastAttemptAt: null,
  now: NOW,
};

describe('когда приложение ищет места само', () => {
  it('при первом запуске с известной домашней точкой — да', () => {
    expect(shouldAutoSearch(base)).toBe(true);
  });

  it('без домашней точки — нет: искать негде', () => {
    expect(shouldAutoSearch({ ...base, hasOrigin: false })).toBe(false);
  });

  it('если достопримечательности уже есть — нет', () => {
    expect(shouldAutoSearch({ ...base, landmarks: 12, osmPlaces: 60 })).toBe(false);
  });

  it('но кафе, найденные раньше, поиску не помеха', () => {
    // База, набранная кнопкой до того, как появились достопримечательности:
    // мест полно, а дойти не до чего.
    expect(shouldAutoSearch({ ...base, landmarks: 0, osmPlaces: 60 })).toBe(true);
  });

  it('если сходили и достопримечательностей в городе не нашлось — не ходим каждый день', () => {
    const tried = {
      ...base,
      osmPlaces: 30,
      landmarks: 0,
      lastAttemptAt: NOW - RETRY_AFTER_MS * 3,
    };
    expect(shouldAutoSearch(tried)).toBe(false);
  });

  it('после неудачной попытки — не раньше чем через сутки', () => {
    const justTried = { ...base, lastAttemptAt: NOW - 60_000 };
    expect(shouldAutoSearch(justTried)).toBe(false);

    // Ничего не приехало (osmPlaces = 0) — значит, попытка была пустой
    // и её стоит повторить.
    const yesterday = { ...base, lastAttemptAt: NOW - RETRY_AFTER_MS };
    expect(shouldAutoSearch(yesterday)).toBe(true);
  });

  it('сутки отсчитываются от попытки, а не от успеха', () => {
    // Иначе телефон без связи ходил бы в сеть при каждом запуске.
    const offlineAllDay = { ...base, lastAttemptAt: NOW - RETRY_AFTER_MS / 2 };
    expect(shouldAutoSearch(offlineAllDay)).toBe(false);
  });
});

describe('настоящее место и демонстрационное', () => {
  it('различаются по идентификатору', () => {
    expect(isOsmPlace('osm-way-12345')).toBe(true);
    expect(isOsmPlace('osm-node-1')).toBe(true);
    expect(isOsmPlace('demo-cafe-1')).toBe(false);
    expect(isOsmPlace('')).toBe(false);
  });
});
