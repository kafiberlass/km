/**
 * Вид места: иконка, цвет, подпись.
 *
 * Один словарь на экран «Места» и на карту — иначе один и тот же парк
 * окажется в двух местах разного цвета, и человек решит, что это разные
 * вещи.
 */

import type { Feather } from '@expo/vector-icons';

import { palette } from '@/core/theme/tokens';

export interface PlaceKindStyle {
  icon: keyof typeof Feather.glyphMap;
  color: string;
  label: string;
}

export const PLACE_KINDS: Record<string, PlaceKindStyle> = {
  cafe: { icon: 'coffee', color: palette.ember, label: 'Кафе' },
  park: { icon: 'sun', color: palette.teal, label: 'Парк' },
  viewpoint: { icon: 'eye', color: palette.rust, label: 'Достопримечательность' },
};

export const FALLBACK_PLACE_KIND: PlaceKindStyle = {
  icon: 'map-pin',
  color: palette.mulberry,
  label: 'Место',
};

export function placeKind(type: string): PlaceKindStyle {
  return PLACE_KINDS[type] ?? FALLBACK_PLACE_KIND;
}
