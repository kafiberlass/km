/**
 * Иконка и цвет плитки для ачивки.
 *
 * Общий словарь для вкладки «Ачивки» и строки последних ачивок в профиле:
 * иначе одна и та же ачивка окажется в двух местах разного цвета.
 *
 * Живёт в ui, а не в core/rules: правила уедут на сервер, картинкам там
 * не место.
 */

import type { Feather } from '@expo/vector-icons';

import { palette } from '@/core/theme/tokens';

export interface Badge {
  icon: keyof typeof Feather.glyphMap;
  color: string;
}

export const BADGES: Record<string, Badge> = {
  'first-steps': { icon: 'flag', color: palette.ember },
  'night-wanderer': { icon: 'moon', color: palette.plum },
  'streak-7': { icon: 'zap', color: palette.rust },
  'streak-30': { icon: 'zap', color: palette.rust },
  'distance-10k': { icon: 'activity', color: palette.teal },
  'distance-100k': { icon: 'activity', color: palette.teal },
  marathon: { icon: 'trending-up', color: palette.gold },
  'explorer-10': { icon: 'compass', color: palette.mulberry },
  'explorer-50': { icon: 'map', color: palette.mulberry },
  'places-10': { icon: 'coffee', color: palette.ember },
  'places-25': { icon: 'coffee', color: palette.mulberry },

  'walks-10': { icon: 'sunrise', color: palette.gold },
  'walks-50': { icon: 'sun', color: palette.gold },
  'walks-100': { icon: 'star', color: palette.gold },
  'active-days-50': { icon: 'calendar', color: palette.teal },
  'streak-100': { icon: 'zap', color: palette.emberDeep },
  'night-25': { icon: 'moon', color: palette.plum },
  'distance-500k': { icon: 'activity', color: palette.teal },
  'distance-1000k': { icon: 'award', color: palette.tealBright },
  'long-walk-25': { icon: 'trending-up', color: palette.gold },
  'district-1': { icon: 'grid', color: palette.teal },
  'district-10': { icon: 'grid', color: palette.tealBright },
  'district-50': { icon: 'layers', color: palette.mulberry },
  'cells-1000': { icon: 'hexagon', color: palette.ember },
  'cells-10000': { icon: 'hexagon', color: palette.emberDeep },
  'explorer-100': { icon: 'map', color: palette.rust },
};

export const FALLBACK_BADGE: Badge = { icon: 'award', color: palette.ember };

export function badgeFor(code: string): Badge {
  return BADGES[code] ?? FALLBACK_BADGE;
}
