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
};

export const FALLBACK_BADGE: Badge = { icon: 'award', color: palette.ember };

export function badgeFor(code: string): Badge {
  return BADGES[code] ?? FALLBACK_BADGE;
}
