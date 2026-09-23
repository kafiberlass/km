import { describe, expect, it } from 'vitest';

import { parseAuthLink } from '../src/features/account/deepLink';

const TOKENS = 'access_token=aaa.bbb.ccc&refresh_token=rrr&token_type=bearer&expires_in=3600';

describe('ссылка из письма', () => {
  it('достаёт сессию из части после решётки', () => {
    const link = parseAuthLink(`km://auth#${TOKENS}`);
    expect(link).toEqual({ kind: 'session', accessToken: 'aaa.bbb.ccc', refreshToken: 'rrr' });
  });

  it('достаёт сессию и из параметров', () => {
    // Supabase переносил токены между частями адреса от версии к версии,
    // и завязываться на одну — способ сломаться на ровном месте.
    const link = parseAuthLink(`km://auth?${TOKENS}`);
    expect(link).toEqual({ kind: 'session', accessToken: 'aaa.bbb.ccc', refreshToken: 'rrr' });
  });

  it('устаревшую ссылку объясняет по-человечески', () => {
    const link = parseAuthLink(
      'km://auth#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
    );
    expect(link).toEqual({ kind: 'error', message: 'Ссылка устарела. Запросите письмо заново' });
  });

  it('использованную ссылку отличает от устаревшей', () => {
    const link = parseAuthLink('km://auth#error=access_denied&error_description=already+used');
    expect(link?.kind).toBe('error');
    expect((link as { message: string }).message).toContain('использована');
  });

  it('отказ важнее токенов: при нём их всё равно нет', () => {
    const link = parseAuthLink(`km://auth#error_code=otp_expired&${TOKENS}`);
    expect(link?.kind).toBe('error');
  });

  it('обычное открытие приложения — не ссылка входа', () => {
    expect(parseAuthLink('km://')).toBeNull();
    expect(parseAuthLink('km://map-full?lng=49.1&lat=55.8')).toBeNull();
    expect(parseAuthLink(null)).toBeNull();
    expect(parseAuthLink('')).toBeNull();
  });

  it('половина сессии — не сессия', () => {
    expect(parseAuthLink('km://auth#access_token=aaa')).toBeNull();
  });
});
