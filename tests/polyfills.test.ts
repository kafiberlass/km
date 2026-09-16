import { afterEach, describe, expect, it } from 'vitest';

import { decodeUtf16le, installUtf16TextDecoder } from '@/core/polyfills/textDecoder';

const NativeTextDecoder = globalThis.TextDecoder;

/** Как в React Native: utf-8 умеет, на остальном бросает. */
class Utf8OnlyTextDecoder {
  constructor(label = 'utf-8') {
    const normalized = String(label).toLowerCase();
    if (normalized !== 'utf-8' && normalized !== 'utf8') {
      throw new RangeError(`Unknown encoding: ${label} (normalized: ${normalized})`);
    }
  }
  decode(input?: ArrayBufferView | ArrayBuffer): string {
    return new NativeTextDecoder('utf-8').decode(input as never);
  }
}

function encodeUtf16le(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length * 2);
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    bytes[i * 2] = code & 0xff;
    bytes[i * 2 + 1] = code >> 8;
  }
  return bytes;
}

afterEach(() => {
  globalThis.TextDecoder = NativeTextDecoder;
});

describe('decodeUtf16le', () => {
  it('читает кириллицу и латиницу', () => {
    expect(decodeUtf16le(encodeUtf16le('Чистые пруды'))).toBe('Чистые пруды');
  });

  it('не переполняет стек на длинной строке', () => {
    const long = 'x'.repeat(50_000);
    expect(decodeUtf16le(encodeUtf16le(long))).toBe(long);
  });

  it('переживает пустой вход', () => {
    expect(decodeUtf16le(new Uint8Array(0))).toBe('');
    expect(decodeUtf16le(null)).toBe('');
  });
});

describe('installUtf16TextDecoder', () => {
  it('ничего не трогает, когда utf-16le и так поддерживается', () => {
    expect(installUtf16TextDecoder()).toBe(false);
    expect(globalThis.TextDecoder).toBe(NativeTextDecoder);
  });

  it('чинит окружение, где utf-16le не поддерживается', () => {
    globalThis.TextDecoder = Utf8OnlyTextDecoder as unknown as typeof TextDecoder;
    // Ровно то, на чём падал h3-js при загрузке.
    expect(() => new globalThis.TextDecoder('utf-16le')).toThrow();

    expect(installUtf16TextDecoder()).toBe(true);

    const decoder = new globalThis.TextDecoder('utf-16le');
    expect(decoder.decode(encodeUtf16le('туман'))).toBe('туман');
    // utf-8 по-прежнему уходит в родную реализацию.
    expect(new globalThis.TextDecoder('utf-8').decode(new Uint8Array([0x4b, 0x4d]))).toBe('KM');
  });
});
