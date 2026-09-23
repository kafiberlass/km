import { describe, expect, it } from 'vitest';

import {
  authMessage,
  isValidCode,
  isValidEmail,
  maskEmail,
  normalizeEmail,
} from '../src/features/account/email';

describe('адрес почты', () => {
  it('убирает пробелы и заглавные буквы', () => {
    // Их добавляют клавиатура и автодополнение, а сервер считает
    // «Kamila@Mail.ru» и «kamila@mail.ru» разными адресами.
    expect(normalizeEmail('  Kamila@Mail.RU ')).toBe('kamila@mail.ru');
  });

  it('пропускает обычные адреса', () => {
    expect(isValidEmail('kamila@mail.ru')).toBe(true);
    expect(isValidEmail('k.a-m_i+la@sub.example.co')).toBe(true);
  });

  it('ловит очевидные опечатки', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('kamila')).toBe(false);
    expect(isValidEmail('kamila@')).toBe(false);
    expect(isValidEmail('@mail.ru')).toBe(false);
    expect(isValidEmail('kamila@mail')).toBe(false);
    expect(isValidEmail('kamila@.ru')).toBe(false);
    expect(isValidEmail('kamila@mail..ru')).toBe(false);
    expect(isValidEmail('kam ila@mail.ru')).toBe(false);
    expect(isValidEmail('два@адреса@mail.ru')).toBe(false);
  });
});

describe('код из письма', () => {
  it('ровно шесть цифр', () => {
    expect(isValidCode('123456')).toBe(true);
    expect(isValidCode(' 123456 ')).toBe(true);
    expect(isValidCode('12345')).toBe(false);
    expect(isValidCode('1234567')).toBe(false);
    expect(isValidCode('12345a')).toBe(false);
    expect(isValidCode('')).toBe(false);
  });
});

describe('показ адреса', () => {
  it('прячет середину', () => {
    expect(maskEmail('kamila@mail.ru')).toBe('k****a@mail.ru');
  });

  it('короткое имя тоже прячет', () => {
    expect(maskEmail('ab@mail.ru')).toBe('a*@mail.ru');
  });

  it('длинное имя не растягивает строку', () => {
    expect(maskEmail('averyveryverylongname@mail.ru')).toBe('a******e@mail.ru');
  });
});

describe('ошибки сервера', () => {
  it('про лимит писем говорит, сколько ждать', () => {
    expect(authMessage({ message: 'Email rate limit exceeded' })).toContain('час');
  });

  it('устаревший код отличает от неверного', () => {
    expect(authMessage('Token has expired')).toContain('устарел');
    expect(authMessage('Invalid token')).toContain('не подошёл');
  });

  it('незнакомую ошибку не выдаёт за понятную', () => {
    expect(authMessage('kaboom')).toBe('Не получилось. Попробуйте ещё раз');
  });
});
