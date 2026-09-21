/**
 * Какая тема выбрана. Отдельным файлом — и это не прихоть.
 *
 * Токены оформления читают половина чистых модулей, а их тесты живут
 * в node, где нет ни react-native, ни нативной базы. Поэтому доступ
 * к хранилищу спрятан здесь, за ленивым require и try: не получилось
 * прочитать — берём тему по умолчанию и работаем дальше.
 */

export type ThemeName = 'aqua' | 'dusk';

/** Что выбрал человек. 'system' — как в телефоне. */
export type ThemeChoice = ThemeName | 'system';

export const THEME_KEY = 'theme';
export const DEFAULT_CHOICE: ThemeChoice = 'system';

function storage(): { getValue(key: string): string | null; setValue(key: string, value: string): void } | null {
  try {
    if (typeof require !== 'function') return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@/core/db/kv');
  } catch {
    return null;
  }
}

/** Ночь ли сейчас по мнению телефона. В node — нет, и это не важно. */
function systemPrefersDark(): boolean {
  try {
    if (typeof require !== 'function') return false;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Appearance } = require('react-native') as typeof import('react-native');
    return Appearance.getColorScheme() === 'dark';
  } catch {
    return false;
  }
}

export function readChoice(): ThemeChoice {
  const raw = storage()?.getValue(THEME_KEY) ?? null;
  return raw === 'aqua' || raw === 'dusk' || raw === 'system' ? raw : DEFAULT_CHOICE;
}

export function writeChoice(choice: ThemeChoice): void {
  storage()?.setValue(THEME_KEY, choice);
}

/** Выбор -> конкретная тема. Чистая функция: её видно тестами. */
export function resolveTheme(choice: ThemeChoice, prefersDark: boolean): ThemeName {
  if (choice === 'aqua' || choice === 'dusk') return choice;
  return prefersDark ? 'dusk' : 'aqua';
}

export function activeTheme(): ThemeName {
  return resolveTheme(readChoice(), systemPrefersDark());
}
