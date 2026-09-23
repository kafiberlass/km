import { describe, expect, it } from 'vitest';

import { MIN_INTERVAL_MS, shouldAutoBackup } from '../src/features/backup/schedule';

const base = {
  enabled: true,
  serverReady: true,
  lastAt: null as number | null,
  lastWalks: null as number | null,
  walks: 3,
  now: 1_000_000_000_000,
};

describe('автоматическая копия', () => {
  it('первая копия уезжает сразу', () => {
    expect(shouldAutoBackup(base)).toBe(true);
  });

  it('выключенная настройка ничего не отправляет', () => {
    expect(shouldAutoBackup({ ...base, enabled: false })).toBe(false);
  });

  it('без ключей сервера отправлять некуда', () => {
    expect(shouldAutoBackup({ ...base, serverReady: false })).toBe(false);
  });

  it('пустую историю не сохраняет', () => {
    // Иначе на новом телефоне такая копия затрёт настоящую.
    expect(shouldAutoBackup({ ...base, walks: 0 })).toBe(false);
  });

  it('не отправляет то же самое второй раз', () => {
    const state = { ...base, lastAt: base.now - MIN_INTERVAL_MS * 2, lastWalks: 3, walks: 3 };
    expect(shouldAutoBackup(state)).toBe(false);
  });

  it('ждёт полсуток, даже если прогулок прибавилось', () => {
    const state = { ...base, lastAt: base.now - MIN_INTERVAL_MS / 2, lastWalks: 3, walks: 4 };
    expect(shouldAutoBackup(state)).toBe(false);
  });

  it('после паузы и новой прогулки — отправляет', () => {
    const state = { ...base, lastAt: base.now - MIN_INTERVAL_MS, lastWalks: 3, walks: 4 };
    expect(shouldAutoBackup(state)).toBe(true);
  });

  it('съехавшие назад часы не запирают копию навсегда', () => {
    // Перевод времени или сброс настроек: без этой ветки разница
    // «сейчас минус тогда» остаётся отрицательной, и полсуток не пройдут
    // никогда.
    const state = { ...base, lastAt: base.now + MIN_INTERVAL_MS * 10, lastWalks: 3, walks: 4 };
    expect(shouldAutoBackup(state)).toBe(true);
  });

  it('но и при съехавших часах не отправляет без новых прогулок', () => {
    const state = { ...base, lastAt: base.now + MIN_INTERVAL_MS * 10, lastWalks: 5, walks: 5 };
    expect(shouldAutoBackup(state)).toBe(false);
  });
});
