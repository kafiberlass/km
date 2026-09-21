/**
 * Токены Frutiger Aero.
 *
 * Держим их в одном месте и ссылаемся только отсюда: цвета тумана, воды
 * и «тропы» используются и в React-компонентах, и в Skia, и в стиле карты
 * MapLibre. Если развести их по трём местам, палитра разъедется на первой
 * же итерации.
 *
 * Главное правило палитры: светится только открытое. Туман — единственное
 * место, где Aero уходит в глубину, и поэтому он тёмный. Контраст
 * «глубина / свечение» и есть механика главного экрана.
 */

export const palette = {
  /** Небо — фон экранов, сверху вниз. */
  skyTop: '#CDEFFF',
  skyHigh: '#8AD9F5',
  skyMid: '#2FA8DC',
  skyLow: '#0B6FA6',

  /** Шапка — то же небо, но насыщеннее, с жёстким стыком бликов. */
  headerTop: '#7FE3FF',
  headerGloss: '#35C6F4',
  headerBreak: '#1591CE',
  headerBottom: '#0A6FA8',

  /** Аква — акцент: активный таб, кнопки, обводка «вы». */
  aquaLight: '#8FE8FF',
  aqua: '#35C6F4',
  aquaDeep: '#1591CE',
  aquaShadow: '#0A6FA8',

  /**
   * Стекло — четыре слоя панели. Между glassMid и glassBreak жёсткий стык:
   * без него получается обычный градиент, а не Aero.
   */
  glassTop: 'rgba(255,255,255,0.95)',
  glassMid: 'rgba(231,248,255,0.76)',
  glassBreak: 'rgba(176,225,248,0.66)',
  glassBottom: 'rgba(132,203,238,0.86)',
  glassEdge: 'rgba(255,255,255,0.92)',

  /** Стекло в покое — неактивный таб, вторичная кнопка. */
  glassIdleTop: 'rgba(255,255,255,0.9)',
  glassIdleBreak: 'rgba(178,224,246,0.5)',
  glassIdleBottom: 'rgba(150,210,240,0.7)',

  /** Тёмное стекло — поверх тумана и в предупреждениях. */
  darkGlassTop: 'rgba(12,68,102,0.88)',
  darkGlassBreak: 'rgba(6,40,64,0.8)',
  darkGlassBottom: 'rgba(9,56,86,0.92)',
  darkGlassEdge: 'rgba(160,224,255,0.45)',
  darkScrim: 'rgba(4,32,52,0.6)',

  /** Трава, прогресс, тропа. */
  limeLight: '#E4FCA8',
  lime: '#A9E64B',
  limeDeep: '#7CC623',
  limeShadow: '#5FA615',
  limeDark: '#3E7A0F',
  limeNight: '#1B5409',

  /** Золото — полученные ачивки. */
  goldLight: '#FFF6D0',
  gold: '#FFD858',
  goldDeep: '#F0B71E',
  goldShadow: '#C98A07',
  goldGlassTop: 'rgba(255,251,230,0.96)',
  goldGlassBreak: 'rgba(252,222,132,0.76)',
  goldGlassBottom: 'rgba(245,203,86,0.9)',

  /** Карта: земля, вода, парки, улицы. */
  land: '#0E8BC4',
  landDeep: '#0A6CA6',
  water: '#1596D6',
  waterLight: '#8FEAFF',
  park: '#5FA81C',
  street: '#D6F6FF',
  streetMajor: '#EEFCFF',
  building: '#0A5E8E',

  /** Туман. */
  fog: '#072F4C',
  fogTop: '#0C4166',
  fogDeep: '#042034',

  /** Тропа: широкое свечение и яркое ядро. */
  trailGlow: '#7CC623',
  trailCore: '#E8FFB4',

  /** Рыбки — три окраски, больше не заводим. */
  fishGold: '#FFC65C',
  fishGoldFin: '#E8701A',
  fishAqua: '#8FE8FF',
  fishAquaFin: '#1591CE',
  fishLime: '#C8F06A',
  fishLimeFin: '#5FA615',

  /** Текст. */
  textOnGlass: '#05364F',
  textMuted: '#1D5C7E',
  textOnDark: '#DCF3FF',
  textOnDarkMuted: '#A9D8EE',
  textOnAqua: '#FFFFFF',
  textOnLime: '#1E3D05',
  textOnGold: '#4A3402',
  textOnGoldMuted: '#6B4E08',
  textIdleTab: '#0A5A85',

  /** Опасное действие — сброс прогресса. */
  dangerTop: 'rgba(255,240,240,0.96)',
  dangerBreak: 'rgba(246,176,176,0.74)',
  dangerBottom: 'rgba(226,120,120,0.9)',
  dangerText: '#7A1B1B',

  white: '#FFFFFF',
  shadow: '#032B45',
} as const;

/** Градиент неба на фоне экрана — стопы для Skia, сверху вниз. */
export const skyBands = [
  palette.skyTop,
  palette.skyHigh,
  palette.skyMid,
  palette.skyLow,
] as const;

/** Градиент шапки. Четвёртый стоп начинается сразу за третьим — это блик. */
export const headerBands = [
  palette.headerTop,
  palette.headerGloss,
  palette.headerBreak,
  palette.headerBottom,
] as const;

/**
 * Позиции стопов стекла. Стык 0.46/0.47 намеренно жёсткий — на нём
 * держится весь эффект «мокрого пластика».
 */
export const glassStops = [0, 0.46, 0.47, 1] as const;

export const radii = {
  sm: 8,
  md: 15,
  lg: 18,
  xl: 22,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/**
 * Шрифты — все с открытой лицензией OFL, встраивание в приложение разрешено.
 * Ставятся через expo-font, файлы кладутся в assets/fonts.
 *
 * Titillium Web взят вместо Frutiger: сам Frutiger проприетарный, а Titillium
 * повторяет его гуманистическую основу и тот самый «техно-оптимизм» эпохи.
 */
export const fonts = {
  display: 'TitilliumWeb-Bold',
  displayMedium: 'TitilliumWeb-SemiBold',
  body: 'SourceSans3-Regular',
  bodyBold: 'SourceSans3-Bold',
} as const;

/** Тени: iOS читает shadow*, Android — elevation. Держим парами. */
export const shadows = {
  panel: {
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 6,
  },
  raised: {
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.38,
    shadowRadius: 26,
    elevation: 10,
  },
} as const;

export const theme = {
  palette,
  skyBands,
  headerBands,
  glassStops,
  radii,
  spacing,
  fonts,
  shadows,
  /** Толщина обводки — «тропа» в настоящих метрах по земле. */
  fog: {
    revealRadiusM: 50,
    /** Радиус мягкой границы тумана, экранные пиксели. */
    edgeBlurPx: 10,
    /** Ширина линии пути, экранные пиксели. */
    trailWidthPx: 6,
    trailDotRadiusPx: 2.5,
  },
  /** Высота полосы травы в подвале шапки. */
  grassHeight: 30,
} as const;

export type Theme = typeof theme;
