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

const aquaPalette = {
  /** Самый тёмный слой: глубина под водой. Тени и текст на светлом. */
  ink: '#06334F',
  /** Фон под туманом — толща воды. */
  fog: '#0B4A72',
  fogSoft: '#0F5C8C',

  /** Панель вкладок — стеклянная синева. */
  bark: '#1187CE',

  /** Подложка экранов: светлое небо, на нём лежат стеклянные карточки. */
  dune: '#DFF4FE',

  /** Земля на карте под туманом — то, что видно в открытом коридоре. */
  ground: '#D6F2E2',

  /** Заливка тумана поверх карты. */
  fogVeil: '#0E5589',

  /** Открытая земля и карточки. */
  sand: '#C3E8FB',
  parchment: '#ECF9FF',
  parchmentBright: '#FFFFFF',

  /** Акцент: прогресс, тропа, активный таб. Тёплый — чтобы жить на синем. */
  ember: '#FF9F1C',
  emberDeep: '#F07800',

  gold: '#FFD23F',
  rust: '#FF5C5C',
  plum: '#7B61FF',
  mulberry: '#B478FF',

  /** Вода и зелень: парки на карте, «свежее» состояние. */
  teal: '#17B8A6',
  tealBright: '#5FE6D2',

  textDark: '#08344F',
  textMuted: '#4E7D99',
  textOnDark: '#FFFFFF',

  /**
   * Стекло. Раньше на этих местах были чёрные обводки в три пикселя;
   * в аэро границу держит не контур, а блик и тень.
   */
  edge: 'rgba(255, 255, 255, 0.75)',
  edgeSoft: 'rgba(8, 52, 79, 0.16)',
  glass: 'rgba(255, 255, 255, 0.35)',
  glassStrong: 'rgba(255, 255, 255, 0.62)',
  /** Тот самый белый блик по верхней половине кнопки. */
  gloss: 'rgba(255, 255, 255, 0.45)',
} as const;

/**
 * Небо в шапке — сверху вниз, от глубокой синевы к белому у горизонта.
 *
 * Полосы, а не градиент: expo-linear-gradient — нативный модуль, а его
 * нельзя доставить обновлением по воздуху. Полос семь, и на глаз между
 * ними получается ровный переход.
 */
const aquaBands = [
  '#0B5C9E',
  '#1E86CE',
  '#35A9E8',
  '#66D3FA',
  '#A5E6FF',
  '#D6F5FF',
  '#FFFFFF',
] as const;

/** Мягкая тень под стеклом. В аэро она заменяет обводку. */
const aquaShadow = {
  shadowColor: '#06334F',
  shadowOpacity: 0.18,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 4,
} as const;

export const radii = {
  sm: 10,
  md: 16,
  lg: 24,
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
