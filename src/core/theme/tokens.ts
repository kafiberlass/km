/**
 * Токены из макета Design map 1.1.
 *
 * Держим их в одном месте и ссылаемся только отсюда: цвета тумана и «тропы»
 * используются и в React-компонентах, и в Skia, и в стиле карты MapLibre.
 * Если развести их по трём местам, палитра разъедется на первой же итерации.
 */

export const palette = {
  /** Фон под туманом — самый тёмный слой. */
  ink: '#241812',
  fog: '#2E1F17',
  fogSoft: '#3A2A1E',

  /** Панель вкладок — тёплый коричневый, светлее карты. Снято с макета. */
  bark: '#684026',

  /** Подложка экранов: светлый песок, на нём лежат карточки. С макета. */
  dune: '#E5D6B7',

  /** Земля на карте под туманом — то, что видно в открытом коридоре. */
  ground: '#DEC49A',

  /** Заливка тумана поверх карты. Снята с макета. */
  fogVeil: '#3F2C1E',

  /** Открытая земля и карточки. */
  sand: '#D9C4A0',
  parchment: '#EFE6D2',
  parchmentBright: '#F5EDDC',

  /** Акцент: прогресс, тропа, активный таб. */
  ember: '#E4713F',
  emberDeep: '#C85430',

  gold: '#E9A83C',
  rust: '#C8483F',
  plum: '#6B3A5B',
  mulberry: '#8E4A5A',

  /** Сетка улиц и парки на карте. */
  teal: '#2E7D6E',
  tealBright: '#3E9E8A',

  textDark: '#2A1B12',
  textMuted: '#6B5544',
  textOnDark: '#F5EDDC',
} as const;

/** Градиент заката в шапке — сверху вниз, как в макете. */
export const sunsetBands = [
  '#4A2A46',
  '#6B3A5B',
  '#8E4A5A',
  '#C8483F',
  '#E4713F',
  '#E9A83C',
  '#F2C94C',
] as const;

export const radii = {
  sm: 6,
  md: 12,
  lg: 18,
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
 */
export const fonts = {
  display: 'Oswald-Bold',
  mono: 'VT323-Regular',
  body: 'Oswald-Regular',
} as const;

export const theme = {
  palette,
  sunsetBands,
  radii,
  spacing,
  fonts,
  /** Толщина обводки — «тропа» в настоящих метрах по земле. */
  fog: {
    revealRadiusM: 50,
    /** Радиус мягкой границы тумана, экранные пиксели. */
    edgeBlurPx: 10,
    /** Ширина оранжевой линии пути, экранные пиксели. */
    trailWidthPx: 6,
    trailDotRadiusPx: 2.5,
  },
} as const;

export type Theme = typeof theme;
