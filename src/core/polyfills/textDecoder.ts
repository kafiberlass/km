/**
 * TextDecoder с поддержкой utf-16le.
 *
 * h3-js собран из C эмскриптеном, и его glue-код на верхнем уровне модуля
 * делает `new TextDecoder("utf-16le")`. В React Native TextDecoder знает
 * только UTF-8 и бросает «Unknown encoding: utf-16le» — то есть приложение
 * падает на первом же импорте h3-js, до единой строки нашего кода.
 *
 * Чинится подменой глобального TextDecoder на обёртку: utf-16 она
 * раскодирует сама, всё остальное отдаёт штатной реализации. Полифил
 * ставится только там, где родной TextDecoder действительно не умеет
 * utf-16le, поэтому в Node (тесты) и в браузере он ничего не меняет.
 *
 * Импортируется из index.js — раньше любого другого кода приложения.
 */

type DecoderInput = ArrayBuffer | ArrayBufferView | null | undefined;

const UTF16_LABELS = new Set(['utf-16le', 'utf-16', 'utf16le', 'ucs-2', 'unicode']);

/** Кодовые единицы UTF-16 лежат парами байт, младший первым. */
export function decodeUtf16le(input: DecoderInput): string {
  if (input == null) return '';

  const bytes =
    input instanceof Uint8Array
      ? input
      : ArrayBuffer.isView(input)
        ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
        : new Uint8Array(input);

  // Строку собираем кусками: fromCharCode на длинном массиве переполняет стек.
  const CHUNK = 4096;
  const units: number[] = [];
  let out = '';

  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const low = bytes[i] ?? 0;
    const high = bytes[i + 1] ?? 0;
    units.push(low | (high << 8));
    if (units.length === CHUNK) {
      out += String.fromCharCode(...units);
      units.length = 0;
    }
  }
  if (units.length > 0) out += String.fromCharCode(...units);

  return out;
}

function nativeSupportsUtf16(Native: typeof TextDecoder | undefined): boolean {
  if (!Native) return false;
  try {
    new Native('utf-16le');
    return true;
  } catch {
    return false;
  }
}

export function installUtf16TextDecoder(): boolean {
  const scope = globalThis as { TextDecoder?: typeof TextDecoder };
  const Native = scope.TextDecoder;

  // Нечего чинить: либо TextDecoder нет вовсе (эмскриптен тогда обходится
  // своей реализацией), либо он уже умеет utf-16.
  if (!Native || nativeSupportsUtf16(Native)) return false;

  class Utf16CapableTextDecoder {
    readonly encoding: string;
    readonly fatal: boolean;
    readonly ignoreBOM: boolean;

    private readonly delegate: InstanceType<typeof TextDecoder> | null;

    constructor(label = 'utf-8', options: TextDecoderOptions = {}) {
      const normalized = String(label).toLowerCase();
      this.encoding = normalized;
      this.fatal = options.fatal ?? false;
      this.ignoreBOM = options.ignoreBOM ?? false;
      this.delegate = UTF16_LABELS.has(normalized) ? null : new Native!(label, options);
    }

    decode(input?: DecoderInput, options?: TextDecodeOptions): string {
      if (this.delegate) return this.delegate.decode(input as never, options);
      return decodeUtf16le(input);
    }
  }

  scope.TextDecoder = Utf16CapableTextDecoder as unknown as typeof TextDecoder;
  return true;
}

installUtf16TextDecoder();
