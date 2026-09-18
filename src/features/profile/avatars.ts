/**
 * Аватар: готовый значок или своя фотография.
 *
 * В базе лежит одной строкой — «preset:fox» или «photo:file:///…».
 * Разбор чистый и с запасом прочности: строку писала программа, но файл
 * фотографии человек может удалить из галереи, а пресет — исчезнуть
 * из списка в следующей версии. Ни то ни другое не должно ломать профиль,
 * поэтому на всё непонятное возвращается значок по умолчанию.
 */

import type { Feather } from '@expo/vector-icons';

import { palette } from '@/core/theme/tokens';

export interface AvatarPreset {
  id: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  /** Подпись для доступности: голосовой доступ читает именно её. */
  label: string;
}

export const AVATAR_PRESETS: readonly AvatarPreset[] = [
  { id: 'moon', icon: 'moon', color: palette.plum, label: 'Луна' },
  { id: 'sun', icon: 'sun', color: palette.gold, label: 'Солнце' },
  { id: 'compass', icon: 'compass', color: palette.teal, label: 'Компас' },
  { id: 'map', icon: 'map', color: palette.mulberry, label: 'Карта' },
  { id: 'feather', icon: 'feather', color: palette.tealBright, label: 'Перо' },
  { id: 'coffee', icon: 'coffee', color: palette.emberDeep, label: 'Кофе' },
  { id: 'star', icon: 'star', color: palette.ember, label: 'Звезда' },
  { id: 'heart', icon: 'heart', color: palette.rust, label: 'Сердце' },
  { id: 'anchor', icon: 'anchor', color: palette.teal, label: 'Якорь' },
  { id: 'zap', icon: 'zap', color: palette.gold, label: 'Молния' },
  { id: 'cloud', icon: 'cloud', color: palette.plum, label: 'Облако' },
  { id: 'camera', icon: 'camera', color: palette.mulberry, label: 'Камера' },
];

export const DEFAULT_PRESET = AVATAR_PRESETS[0]!;

export type Avatar =
  | { kind: 'preset'; preset: AvatarPreset }
  | { kind: 'photo'; uri: string };

export function presetAvatarValue(id: string): string {
  return `preset:${id}`;
}

export function photoAvatarValue(uri: string): string {
  return `photo:${uri}`;
}

export function parseAvatar(raw: string | null | undefined): Avatar {
  if (!raw) return { kind: 'preset', preset: DEFAULT_PRESET };

  if (raw.startsWith('photo:')) {
    const uri = raw.slice('photo:'.length);
    // Пустой путь — это не фотография, а мусор в базе.
    return uri.length > 0 ? { kind: 'photo', uri } : { kind: 'preset', preset: DEFAULT_PRESET };
  }

  if (raw.startsWith('preset:')) {
    const id = raw.slice('preset:'.length);
    const preset = AVATAR_PRESETS.find((candidate) => candidate.id === id);
    return { kind: 'preset', preset: preset ?? DEFAULT_PRESET };
  }

  return { kind: 'preset', preset: DEFAULT_PRESET };
}

/**
 * Инициалы для метки на карте и для кружка, пока имя не заполнено.
 *
 * Две буквы: одна теряется среди аватарок, три не влезают в кружок.
 */
export function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter((part) => part.length > 0);
  if (parts.length === 0) return 'КМ';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}
