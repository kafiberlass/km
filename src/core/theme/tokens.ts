import { activeTheme, type ThemeName } from './choice';

/**
 * Токены оформления.
 *
 * Держим их в одном месте и ссылаемся только отсюда: цвета тумана и «тропы»
 * используются и в React-компонентах, и в Skia, и в стиле карты MapLibre.
 * Если развести их по трём местам, палитра разъедется на первой же итерации.
 *
 * Оформление — Frutiger Aero: вода, стекло и блики. Это стиль конца
 * двухтысячных (Windows Vista, Wii, первые айфоны): прозрачные панели,
 * белый глянец сверху, аквамарин и небесно-синий, мягкие тени вместо
 * жирных контуров.
 *
 * Прежняя палитра была землисто-бумажной, с толстыми чёрными обводками.
 * Имена токенов от неё остались — их знает половина файлов, и переименование
 * ради красоты стоило бы дороже, чем приносило. Поэтому «песок» и
 * «пергамент» теперь означают оттенки воды и стекла.
 */

/**
 * Аква — по макету «КМ · Frutiger Aero».
 *
 * Значения взяты из него как есть: aqua #1591CE, небо #CDEFFF → #8AD9F5,
 * лайм #7CC623, золото #F0B71E, туман #072F4C. Имена токенов прежние:
 * их знает половина файлов, и переименование ради точности стоило бы
 * дороже, чем приносило.
 */
const aquaPalette = {
  /** Туман войны. Единственное место, где аэро уходит в глубину. */
  ink: '#04283E',
  fog: '#072F4C',
  fogSoft: '#0A4064',

  /** Панель вкладок и шапка. */
  bark: '#1591CE',

  /** Подложка экранов — верх небесного градиента. */
  dune: '#CDEFFF',

  /** Открытая земля на карте: она светится, туман — нет. */
  ground: '#DCF3FF',

  /** Заливка тумана поверх карты. */
  fogVeil: '#072F4C',

  /** Низ небесного градиента и вторая поверхность стекла. */
  sand: '#8AD9F5',
  parchment: '#DCF3FF',
  parchmentBright: '#FFFFFF',

  /** Тропа и живое: лайм. По макету это награда за пройденное. */
  ember: '#7CC623',
  emberDeep: '#5FA615',
  /** Ядро тропы — почти белый лайм, светится изнутри. */
  trailCore: '#E8FFB4',

  gold: '#F0B71E',
  /** Тёплый акцент: рыбки, огонь серии. */
  rust: '#E8701A',
  plum: '#0A6FA8',
  mulberry: '#1591CE',

  teal: '#1591CE',
  tealBright: '#8FE8FF',

  /** Текст на стекле. */
  textDark: '#05364F',
  textMuted: '#1D5C7E',
  /** Текст на тумане. */
  textOnDark: '#DCF3FF',
  textOnFog: '#A9D8EE',

  /** Стекло: белый от 95% сверху до 66% снизу. */
  edge: 'rgba(255, 255, 255, 0.95)',
  edgeSoft: 'rgba(5, 54, 79, 0.14)',
  glass: 'rgba(255, 255, 255, 0.66)',
  glassStrong: 'rgba(255, 255, 255, 0.95)',
  gloss: 'rgba(255, 255, 255, 0.95)',
} as const;

const aquaBands = [
  '#0A5A85',
  '#0A6FA8',
  '#1591CE',
  '#5FC0EA',
  '#8AD9F5',
  '#CDEFFF',
  '#FFFFFF',
] as const;

/** Мягкая тень под стеклом. В аэро она заменяет обводку. */
const aquaShadow = {
  shadowColor: '#05364F',
  shadowOpacity: 0.22,
  shadowRadius: 26,
  shadowOffset: { width: 0, height: 12 },
  elevation: 6,
} as const;

export const radii = {
  sm: 13,
  md: 18,
  lg: 22,
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
 * Шрифты — системные.
 *
 * Сам Frutiger, давший стилю имя, — гуманистическая гротеска, и системные
 * шрифты телефонов (San Francisco, Roboto) из того же семейства: округлые,
 * открытые, без характера. Это ровно то, что нужно.
 *
 * Прежние Oswald и VT323 остались в assets: узкий гротеск и пиксельный
 * терминальный шрифт — из совсем другой эпохи, рядом со стеклом они
 * выглядели бы случайными гостями.
 */
/*
  Пустое значение, а не название шрифта: так каждая система берёт свой
  собственный — San Francisco на iPhone, Roboto на Android. Начертание
  задаётся весом (fontWeight) там, где оно нужно.

  Через Platform.select было бы нагляднее, но это импорт react-native
  в файл, который читают и чистые модули; тесты на них живут в node,
  где react-native нет.
*/
const system = undefined;

const aquaFonts = {
  display: system,
  mono: system,
  body: system,
} as const;

/**
 * Вторая тема — «Сумерки»: то самое прежнее оформление.
 *
 * Земля, пергамент и чернила: тёмная карта, светлые карточки на песке,
 * жирные контуры, узкий гротеск в заголовках и пиксельные цифры.
 * Оно никуда не делось — стало ночным.
 */
const duskPalette = {
  ink: '#241812',
  fog: '#2E1F17',
  fogSoft: '#3A2A1E',

  bark: '#684026',
  dune: '#E5D6B7',
  ground: '#DEC49A',
  fogVeil: '#3F2C1E',

  sand: '#D9C4A0',
  parchment: '#EFE6D2',
  parchmentBright: '#F5EDDC',

  ember: '#E4713F',
  emberDeep: '#C85430',

  gold: '#E9A83C',
  rust: '#C8483F',
  plum: '#6B3A5B',
  mulberry: '#8E4A5A',

  teal: '#2E7D6E',
  tealBright: '#3E9E8A',

  textDark: '#2A1B12',
  textMuted: '#6B5544',
  textOnDark: '#F5EDDC',
  textOnFog: '#D9C4A0',
  trailCore: '#F2C94C',

  // В сумерках границу держит контур, а не блик: стекла здесь нет.
  edge: '#241812',
  edgeSoft: '#241812',
  glass: 'rgba(36, 24, 18, 0.08)',
  glassStrong: 'rgba(36, 24, 18, 0.16)',
  gloss: 'transparent',
} as const;

/** Закат в шапке — сверху вниз. */
const duskBands = [
  '#4A2A46',
  '#6B3A5B',
  '#8E4A5A',
  '#C8483F',
  '#E4713F',
  '#E9A83C',
  '#F2C94C',
] as const;

/** В сумерках тени нет: её роль играет чёрный контур. */
const duskShadow = {
  shadowColor: 'transparent',
  shadowOpacity: 0,
  shadowRadius: 0,
  shadowOffset: { width: 0, height: 0 },
  elevation: 0,
} as const;

const duskFonts = {
  display: 'Oswald-Bold',
  mono: 'VT323-Regular',
  body: 'Oswald-Regular',
} as const;

/**
 * Какая тема сейчас.
 *
 * Определяется один раз при запуске: стили в React Native собираются
 * в момент загрузки файла, и подменить их на лету нельзя. Поэтому смена
 * темы просит перезапустить приложение — так же, как это делают системные
 * настройки языка.
 */
export const themeName: ThemeName = activeTheme();

const isDusk = themeName === 'dusk';

export const palette = (isDusk ? duskPalette : aquaPalette) as typeof aquaPalette;
export const skyBands = isDusk ? duskBands : aquaBands;
export const shadow = isDusk ? duskShadow : aquaShadow;
export const fonts = (isDusk ? duskFonts : aquaFonts) as typeof aquaFonts;

/**
 * Толщина контура.
 *
 * В акве границу держит блик, и линия нужна волосяная. В сумерках
 * наоборот: жирный контур — главная примета того оформления.
 */
export const line = isDusk ? 3 : 1;

export const theme = {
  palette,
  skyBands,
  shadow,
  line,
  themeName,
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
