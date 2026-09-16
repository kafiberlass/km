import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Регрессия на падение старта приложения.
 *
 * h3-js собран эмскриптеном и на верхнем уровне модуля делает
 * `new TextDecoder("utf-16le")`. В React Native TextDecoder знает только
 * utf-8, поэтому импорт h3-js ронял приложение раньше первого экрана:
 * «Unknown encoding: utf-16le». Тест воспроизводит то окружение в Node
 * и проверяет, что с полифилом библиотека поднимается и считает.
 *
 * Обратный случай (без полифила h3-js падает) отдельным тестом не проверяется
 * намеренно: модуль, упавший при загрузке, остаётся в реестре vitest сломанным
 * и портит остальные тесты файла.
 */

const NativeTextDecoder = globalThis.TextDecoder;

class Utf8OnlyTextDecoder {
  private readonly delegate: InstanceType<typeof TextDecoder>;
  constructor(label = 'utf-8') {
    const normalized = String(label).toLowerCase();
    if (normalized !== 'utf-8' && normalized !== 'utf8') {
      throw new RangeError(`Unknown encoding: ${label} (normalized: ${normalized})`);
    }
    this.delegate = new NativeTextDecoder('utf-8');
  }
  decode(input?: ArrayBufferView | ArrayBuffer): string {
    return this.delegate.decode(input as never);
  }
}

afterEach(() => {
  globalThis.TextDecoder = NativeTextDecoder;
});

describe('h3-js в окружении с TextDecoder только для utf-8', () => {
  it('с полифилом загружается и считает ячейки', async () => {
    vi.resetModules();
    globalThis.TextDecoder = Utf8OnlyTextDecoder as unknown as typeof TextDecoder;
    // Именно эта строка и падала раньше внутри h3-js.
    expect(() => new globalThis.TextDecoder('utf-16le')).toThrow(/utf-16le/);

    await import('@/core/polyfills/textDecoder');
    const { latLngToCell } = await import('h3-js');

    expect(latLngToCell(55.7625, 37.6425, 11)).toMatch(/^8b/);
  });
});
