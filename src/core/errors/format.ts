/**
 * Разбор ошибки в текст, который не стыдно показать человеку.
 *
 * Отдельно от хранения намеренно: `lastError.ts` открывает базу, а базы
 * в тестах нет — нативный SQLite в vitest не живёт. Здесь только чистые
 * функции, и они проверяются.
 */

export interface SavedError {
  at: number;
  fatal: boolean;
  text: string;
}

/**
 * Ошибка в человекочитаемый вид.
 *
 * Стек режется: первые строки говорят всё, а целиком он не влезает
 * ни в экран, ни в сообщение, которым его перешлют.
 */
export function describeError(error: unknown, stackLines = 6): string {
  if (error instanceof Error) {
    const head = `${error.name}: ${error.message}`;
    const stack = (error.stack ?? '')
      .split('\n')
      .slice(1, 1 + stackLines)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    return [head, ...stack].join('\n');
  }

  if (typeof error === 'string') return error;

  try {
    // JSON.stringify(undefined) возвращает не строку, а undefined —
    // и запись об ошибке сама оказывалась пустой.
    return JSON.stringify(error) ?? String(error);
  } catch {
    return String(error);
  }
}

/** Разбор сохранённого. Мусор в базе не должен ронять экран настроек. */
export function parseSavedError(raw: string | null): SavedError | null {
  if (raw == null) return null;

  try {
    const value = JSON.parse(raw) as Partial<SavedError>;
    if (typeof value.text !== 'string' || value.text.length === 0) return null;

    return {
      at: typeof value.at === 'number' ? value.at : 0,
      fatal: value.fatal === true,
      text: value.text,
    };
  } catch {
    return null;
  }
}
