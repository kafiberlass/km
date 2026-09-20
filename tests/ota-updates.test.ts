import { describe, expect, it } from 'vitest';

import { classifyUpdateError, updateMessage } from '@/features/updates/ota';

describe('разбор ошибки обновления', () => {
  it('сетевые ошибки отличаются от остальных', () => {
    expect(classifyUpdateError(new Error('Network request failed'))).toBe('offline');
    expect(classifyUpdateError(new TypeError('fetch timeout'))).toBe('offline');
    expect(classifyUpdateError(new Error('Нет соединения'))).toBe('offline');
  });

  it('всё прочее — поломка, а не отсутствие интернета', () => {
    expect(classifyUpdateError(new Error('manifest signature invalid'))).toBe('failed');
    expect(classifyUpdateError('что-то пошло не так')).toBe('failed');
    expect(classifyUpdateError(null)).toBe('failed');
  });
});

describe('фраза под кнопкой', () => {
  it('на каждый исход своя, и ни одна не пустая', () => {
    const results = ['ready', 'none', 'unsupported', 'offline', 'failed'] as const;
    const said = results.map((result) => updateMessage(result));

    expect(new Set(said).size).toBe(results.length);
    for (const text of said) expect(text.length).toBeGreaterThan(0);
  });

  it('не говорит «обновлено», пока приложение не перезапустили', () => {
    // Свёрток скачан, но работает всё ещё старый код: обещать обратное
    // значит получить «ты же сказал, что обновилось, а ничего не поменялось».
    expect(updateMessage('ready')).toContain('Перезапустите');
  });
});
