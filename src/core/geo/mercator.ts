/**
 * Web Mercator + матрица камеры для Skia-слоя тумана.
 *
 * Идея: туман рисуется ОДИН раз в локальных координатах (метры Меркатора
 * относительно origin пользователя), а при движении карты меняется только
 * матрица трансформации. Перестройка геометрии на каждый кадр не нужна,
 * поэтому производительность не зависит от длины истории прогулок.
 *
 * Модуль чистый: никаких импортов из React Native, гоняется в vitest.
 */

export const EARTH_RADIUS_M = 6378137;
export const EARTH_CIRCUMFERENCE_M = 2 * Math.PI * EARTH_RADIUS_M;

/** Размер тайла, который использует MapLibre для векторных источников. */
export const TILE_SIZE_PX = 512;

export interface LngLat {
  lng: number;
  lat: number;
}

/** Точка в метрах Меркатора относительно origin. */
export interface LocalPoint {
  x: number;
  y: number;
}

export interface CameraState {
  /** Центр вьюпорта. */
  center: LngLat;
  zoom: number;
  /** Азимут камеры в градусах, как его отдаёт MapLibre. */
  bearing: number;
  /** Размер вьюпорта в px (не dp — умножьте на PixelRatio, если нужно). */
  width: number;
  height: number;
}

/** Матрица 3x3 в row-major порядке — формат, который принимает Skia `Group`. */
export type Matrix3x3 = readonly [
  number, number, number,
  number, number, number,
  number, number, number,
];

const MAX_MERCATOR_LAT = 85.051129;

export function clampLat(lat: number): number {
  return Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, lat));
}

/** Абсолютные метры Меркатора (origin — пересечение экватора и нулевого меридиана). */
export function lngLatToMercator(p: LngLat): LocalPoint {
  const lat = clampLat(p.lat);
  const x = (p.lng * Math.PI) / 180 * EARTH_RADIUS_M;
  const y = Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * EARTH_RADIUS_M;
  return { x, y };
}

export function mercatorToLngLat(p: LocalPoint): LngLat {
  const lng = (p.x / EARTH_RADIUS_M) * (180 / Math.PI);
  const lat = (2 * Math.atan(Math.exp(p.y / EARTH_RADIUS_M)) - Math.PI / 2) * (180 / Math.PI);
  return { lng, lat };
}

/**
 * Проектор с локальным origin.
 *
 * Зачем origin: абсолютные метры Меркатора доходят до 2e7, а Skia считает
 * во float32 (~7 значащих цифр). На таких величинах шаг сетки становится
 * больше метра и трек начинает «дрожать». Сдвиг к локальному origin убирает
 * проблему: в пределах города координаты не выходят за ±5e4.
 */
export function createProjector(origin: LngLat) {
  const originMerc = lngLatToMercator(origin);
  return {
    origin,
    originMerc,
    toLocal(p: LngLat): LocalPoint {
      const m = lngLatToMercator(p);
      return { x: m.x - originMerc.x, y: m.y - originMerc.y };
    },
    toLngLat(p: LocalPoint): LngLat {
      return mercatorToLngLat({ x: p.x + originMerc.x, y: p.y + originMerc.y });
    },
  };
}

export type Projector = ReturnType<typeof createProjector>;

/** Сколько экранных пикселей приходится на один метр Меркатора при данном зуме. */
export function pixelsPerMercatorMeter(zoom: number): number {
  return (TILE_SIZE_PX * Math.pow(2, zoom)) / EARTH_CIRCUMFERENCE_M;
}

/**
 * Меркатор растягивает расстояния в 1/cos(lat) раз. Радиус раскрытия тумана
 * задаётся в НАСТОЯЩИХ метрах по земле, поэтому перед отрисовкой его надо
 * перевести в метры Меркатора — иначе в Мурманске тропа будет вдвое уже,
 * чем в Каире.
 */
export function groundMetersToMercatorMeters(meters: number, lat: number): number {
  return meters / Math.cos((clampLat(lat) * Math.PI) / 180);
}

export function mercatorMetersToGroundMeters(meters: number, lat: number): number {
  return meters * Math.cos((clampLat(lat) * Math.PI) / 180);
}

/**
 * Матрица «локальные метры Меркатора -> экранные пиксели».
 *
 * Питч не поддерживается сознательно: перспектива требует полноценного 4x4
 * и ломает постоянную толщину обводки. Карта в этом приложении плоская.
 */
export function cameraMatrix(camera: CameraState, projector: Projector): Matrix3x3 {
  const s = pixelsPerMercatorMeter(camera.zoom);
  const a = (-camera.bearing * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);

  const cam = projector.toLocal(camera.center);
  const cx = camera.width / 2;
  const cy = camera.height / 2;

  // Ось Y у Меркатора смотрит на север, у экрана — вниз, отсюда минусы.
  const m00 = s * cos;
  const m01 = s * sin;
  const m10 = s * sin;
  const m11 = -s * cos;

  const m02 = cx - (m00 * cam.x + m01 * cam.y);
  const m12 = cy - (m10 * cam.x + m11 * cam.y);

  return [m00, m01, m02, m10, m11, m12, 0, 0, 1] as const;
}

/**
 * Та же матрица, но пригодная для запуска в воркете Reanimated.
 *
 * Отличия от `cameraMatrix`: никаких замыканий, объектов и импортов —
 * только числа и Math. Это позволяет пересчитывать матрицу прямо на UI-потоке
 * на каждый кадр жеста, не будя JS-поток и не вызывая ре-рендер React.
 *
 * Возвращает обычный number[], который Skia принимает как InputMatrix,
 * поэтому создавать SkMatrix в воркете не нужно.
 */
export function cameraMatrixWorklet(
  centerLng: number,
  centerLat: number,
  zoom: number,
  bearing: number,
  width: number,
  height: number,
  originMercX: number,
  originMercY: number,
): number[] {
  'worklet';
  const R = 6378137;
  const circumference = 2 * Math.PI * R;

  const lat = centerLat > 85.051129 ? 85.051129 : centerLat < -85.051129 ? -85.051129 : centerLat;
  const camX = ((centerLng * Math.PI) / 180) * R - originMercX;
  const camY = Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * R - originMercY;

  const s = (512 * Math.pow(2, zoom)) / circumference;
  const a = (-bearing * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);

  const m00 = s * cos;
  const m01 = s * sin;
  const m10 = s * sin;
  const m11 = -s * cos;

  return [
    m00,
    m01,
    width / 2 - (m00 * camX + m01 * camY),
    m10,
    m11,
    height / 2 - (m10 * camX + m11 * camY),
    0,
    0,
    1,
  ];
}

/**
 * Координата -> точка на экране, тем же преобразованием, что и туман.
 *
 * Нужна для меток поверх карты (друзья, их места): они живут в React, а не
 * в Skia, и должны ехать за картой кадр в кадр. Поэтому — воркет: матрица
 * уже посчитана на UI-потоке, остаётся умножить на неё точку.
 */
export function projectToScreenWorklet(
  lng: number,
  lat: number,
  matrix: number[],
  originMercX: number,
  originMercY: number,
): { x: number; y: number } {
  'worklet';
  const R = 6378137;
  const clamped = lat > 85.051129 ? 85.051129 : lat < -85.051129 ? -85.051129 : lat;

  const px = ((lng * Math.PI) / 180) * R - originMercX;
  const py = Math.log(Math.tan(Math.PI / 4 + (clamped * Math.PI) / 360)) * R - originMercY;

  return {
    x: (matrix[0] ?? 0) * px + (matrix[1] ?? 0) * py + (matrix[2] ?? 0),
    y: (matrix[3] ?? 0) * px + (matrix[4] ?? 0) * py + (matrix[5] ?? 0),
  };
}

/** Обратное преобразование — нужно, чтобы отсечь невидимые сегменты трека. */
export function visibleLocalBounds(
  camera: CameraState,
  projector: Projector,
  paddingPx = 0,
): { minX: number; minY: number; maxX: number; maxY: number } {
  const s = pixelsPerMercatorMeter(camera.zoom);
  const cam = projector.toLocal(camera.center);

  // При повороте камеры описанный прямоугольник вьюпорта увеличивается,
  // берём его диагональ — дешевле, чем считать честный повёрнутый bbox.
  const halfDiag = Math.hypot(camera.width, camera.height) / 2 + paddingPx;
  const radiusMerc = halfDiag / s;

  return {
    minX: cam.x - radiusMerc,
    minY: cam.y - radiusMerc,
    maxX: cam.x + radiusMerc,
    maxY: cam.y + radiusMerc,
  };
}

/** Расстояние по земле между двумя координатами, метры. */
export function haversineMeters(a: LngLat, b: LngLat): number {
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLng = (b.lng - a.lng) * toRad;
  const lat1 = a.lat * toRad;
  const lat2 = b.lat * toRad;

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}
