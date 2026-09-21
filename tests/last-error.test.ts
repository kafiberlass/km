import { describe, expect, it } from 'vitest';

import { describeError, parseSavedError } from '@/core/errors/format';

describe('описание ошибки', () => {
  it('начинается с названия и сообщения', () => {
    const error = new TypeError('undefined is not a function');
    expect(describeError(error).split('\n')[0]).toBe(
      'TypeError: undefined is not a function',
    );
  });

  it('стек обрезается — целиком он никуда не влезает', () => {
    const error = new Error('поломка');
    error.stack = ['Error: поломка', ...Array.from({ length: 40 }, (_, i) => `  at f${i}`)].join(
      '\n',
    );
    expect(describeError(error, 6).split('\n')).toHaveLength(7);
  });

  it('не-ошибки тоже превращаются в текст', () => {
    expect(describeError('просто строка')).toBe('просто строка');
    expect(describeError({ code: 42 })).toBe('{"code":42}');
    expect(describeError(null)).toBe('null');
    // JSON.stringify(undefined) — не строка, и без запасного варианта
    // запись об ошибке оказывалась пустой.
    expect(describeError(undefined)).toBe('undefined');
  });

  it('объект с циклом не роняет разбор', () => {
    const loop: Record<string, unknown> = {};
    loop.self = loop;
    expect(() => describeError(loop)).not.toThrow();
  });
});

describe('чтение сохранённой ошибки', () => {
  it('нормальная запись читается', () => {
    const saved = parseSavedError('{"at":1780000000000,"fatal":true,"text":"Error: ой"}');
    expect(saved).toEqual({ at: 1780000000000, fatal: true, text: 'Error: ой' });
  });

  it('мусор и пустота дают null, а не исключение', () => {
    for (const bad of [null, '', 'не json', '{}', '{"text":""}', '[]']) {
      expect(parseSavedError(bad)).toBeNull();
    }
  });

  it('недостающие поля заполняются безопасно', () => {
    expect(parseSavedError('{"text":"Error: ой"}')).toEqual({
      at: 0,
      fatal: false,
      text: 'Error: ой',
    });
  });
});
