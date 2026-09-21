/**
 * Чёрный ящик: что именно сломалось в последний раз.
 *
 * Приложение стоит на телефонах в других городах, и когда оно «просто
 * вылетает», починить это невозможно: сообщение об ошибке умирает вместе
 * с процессом, а человек на том конце видит пустой экран и не обязан
 * знать слов «стектрейс» и «логи».
 *
 * Поэтому ошибка записывается в ту же базу, переживает перезапуск и
 * показывается на экране настроек — оттуда её можно отправить одной
 * кнопкой.
 */

import { getValue, removeValue, setValue } from '@/core/db/kv';

import { describeError, parseSavedError, type SavedError } from './format';

const KEY = 'last-error';

export type { SavedError };
export { describeError } from './format';

export function rememberError(error: unknown, fatal: boolean): void {
  try {
    const saved: SavedError = { at: Date.now(), fatal, text: describeError(error) };
    setValue(KEY, JSON.stringify(saved));
  } catch {
    // Запись об ошибке, уронившая приложение, — худшее, что может быть.
  }
}

export function readLastError(): SavedError | null {
  try {
    return parseSavedError(getValue(KEY));
  } catch {
    return null;
  }
}

export function clearLastError(): void {
  try {
    removeValue(KEY);
  } catch {
    // Не смогли забыть ошибку — переживём.
  }
}
