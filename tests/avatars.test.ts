import { describe, expect, it } from 'vitest';

import {
  AVATAR_PRESETS,
  DEFAULT_PRESET,
  initialsOf,
  parseAvatar,
  photoAvatarValue,
  presetAvatarValue,
} from '@/features/profile/avatars';

describe('аватар из базы', () => {
  it('готовый значок переживает запись и чтение', () => {
    const preset = AVATAR_PRESETS[3]!;
    const parsed = parseAvatar(presetAvatarValue(preset.id));
    expect(parsed).toEqual({ kind: 'preset', preset });
  });

  it('фотография переживает запись и чтение', () => {
    const uri = 'file:///data/avatars/avatar-1.jpg';
    expect(parseAvatar(photoAvatarValue(uri))).toEqual({ kind: 'photo', uri });
  });

  it('пустое и непонятное превращается в значок по умолчанию', () => {
    for (const raw of [null, undefined, '', 'мусор', 'photo:', 'preset:', 'preset:такого-нет']) {
      expect(parseAvatar(raw)).toEqual({ kind: 'preset', preset: DEFAULT_PRESET });
    }
  });

  it('значки не повторяются по идентификатору', () => {
    const ids = AVATAR_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('инициалы', () => {
  it('из имени и фамилии — по первой букве', () => {
    expect(initialsOf('Камила Иванова')).toBe('КИ');
  });

  it('из одного слова — две первые буквы', () => {
    expect(initialsOf('Камила')).toBe('КА');
  });

  it('лишние пробелы не мешают', () => {
    expect(initialsOf('  Камила   Иванова  ')).toBe('КИ');
  });

  it('без имени — буквы приложения', () => {
    expect(initialsOf(null)).toBe('КМ');
    expect(initialsOf('   ')).toBe('КМ');
  });
});
