import { describe, expect, it } from 'vitest';

import { resolveTheme } from '@/core/theme/choice';

describe('выбор темы', () => {
  it('выбранная человеком тема побеждает системную', () => {
    expect(resolveTheme('aqua', true)).toBe('aqua');
    expect(resolveTheme('dusk', false)).toBe('dusk');
  });

  it('«как в системе» идёт за телефоном', () => {
    expect(resolveTheme('system', true)).toBe('dusk');
    expect(resolveTheme('system', false)).toBe('aqua');
  });
});
