import { describe, expect, it, vi } from 'vitest';

import { createFlagStore } from '@/core/settings/flagStore';

describe('переключатель на несколько экранов', () => {
  it('читает базу лениво и только один раз', () => {
    const load = vi.fn(() => true);
    const store = createFlagStore(load, vi.fn());

    expect(load).not.toHaveBeenCalled();
    expect(store.get()).toBe(true);
    expect(store.get()).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('сохраняет и будит подписчиков', () => {
    const save = vi.fn();
    const store = createFlagStore(() => true, save);
    const listener = vi.fn();
    store.subscribe(listener);

    store.set(false);

    expect(store.get()).toBe(false);
    expect(save).toHaveBeenCalledWith(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('повторная запись того же значения никого не будит', () => {
    const save = vi.fn();
    const store = createFlagStore(() => true, save);
    const listener = vi.fn();
    store.subscribe(listener);

    store.set(true);

    expect(save).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  });

  it('отписка работает', () => {
    const store = createFlagStore(() => true, vi.fn());
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    unsubscribe();
    store.toggle();

    expect(listener).not.toHaveBeenCalled();
  });

  it('toggle возвращает новое значение', () => {
    const store = createFlagStore(() => false, vi.fn());
    expect(store.toggle()).toBe(true);
    expect(store.get()).toBe(true);
  });
});
