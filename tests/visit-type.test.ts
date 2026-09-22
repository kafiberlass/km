import { describe, expect, it } from 'vitest';

import { visitTypeOf } from '@/features/friends/visitType';

describe('вид места для сервера', () => {
  it('известные виды уходят как есть', () => {
    for (const type of ['cafe', 'park', 'viewpoint', 'landmark']) {
      expect(visitTypeOf(type)).toBe(type);
    }
  });

  it('неизвестный вид не роняет отправку', () => {
    // На сервере стоит проверка списком: чужое значение он отвергнет
    // целиком, и визит пропадёт молча.
    expect(visitTypeOf('spaceport')).toBe('viewpoint');
    expect(visitTypeOf('')).toBe('viewpoint');
  });
});
