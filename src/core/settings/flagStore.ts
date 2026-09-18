/**
 * Переключатель, который видят сразу все экраны.
 *
 * Флаг лежит в SQLite (переживает перезапуск), но экранов с картой два,
 * и дев-панель — третий: если каждый будет читать базу в своём `useState`,
 * выключенный в панели туман останется на карте до перезахода в приложение.
 * Поэтому значение кешируется в памяти, а подписчики узнают о смене сразу.
 *
 * Чтение и запись приходят снаружи — модуль не знает про базу и проверяется
 * в vitest без нативной SQLite.
 */

export interface FlagStore {
  get(): boolean;
  set(value: boolean): void;
  toggle(): boolean;
  subscribe(listener: () => void): () => void;
}

export function createFlagStore(load: () => boolean, save: (value: boolean) => void): FlagStore {
  // null = «из базы ещё не читали». Читаем лениво: модуль импортируется
  // раньше, чем открывается база.
  let cached: boolean | null = null;
  const listeners = new Set<() => void>();

  const get = (): boolean => {
    if (cached === null) cached = load();
    return cached;
  };

  const set = (value: boolean): void => {
    if (get() === value) return;
    cached = value;
    save(value);
    for (const listener of listeners) listener();
  };

  return {
    get,
    set,
    toggle: () => {
      const next = !get();
      set(next);
      return next;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
