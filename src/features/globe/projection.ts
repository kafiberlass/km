/**
 * Ортографическая проекция — та самая, в которой планета выглядит шаром,
 * как с орбиты.
 *
 * Зачем свой код: нативный MapLibre (в отличие от веб-версии) проекцию
 * «глобус» не умеет, в @maplibre/maplibre-react-native её нет вовсе.
 * Поэтому при сильном отдалении плоская карта гасится, а сверху рисуется
 * наш собственный шар на Skia.
 *
 * Чистые функции без React и Skia: проверяются в vitest.
 */

const RAD = Math.PI / 180;

export interface GlobeView {
  /** Центр шара на экране, пиксели. */
  cx: number;
  cy: number;
  /** Радиус шара, пиксели. */
  r: number;
  /** Точка, повёрнутая к зрителю: её камера и показывала на плоской карте. */
  lng0: number;
  lat0: number;
}

export interface GlobePoint {
  x: number;
  y: number;
  /** false — точка на обратной стороне планеты. */
  front: boolean;
}

/**
 * Переход «карта -> планета» разложен на две фазы, и они не пересекаются.
 *
 * Сначала карта растворяется в ночи (`spaceOpacity`), и только потом,
 * на уже чёрном небе, проявляется и подрастает шар (`globeOpacity`,
 * `globeScale`). Одновременное проявление выглядело браком: сквозь
 * полупрозрачные материки просвечивали тайлы, две картинки накладывались
 * друг на друга.
 *
 * Границы: отдаление идёт справа налево, от 5 (страна на экране)
 * до 2.5 (планета целиком).
 */
export const GLOBE_ZOOM_NONE = 5;
/** К этому зуму карта уже полностью скрыта под ночным небом. */
export const SPACE_ZOOM_FULL = 3.9;
/** С этого зума начинает проявляться сам шар — заведомо позже неба. */
export const GLOBE_ZOOM_START = 3.7;
export const GLOBE_ZOOM_FULL = 2.5;

/** Планета появляется не сразу во всю величину, а подрастает. */
export const GLOBE_SCALE_START = 0.75;

/** Сглаживание: у линейного проявления видно момент старта и остановки. */
export function smoothstep(t: number): number {
  'worklet';
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}

/** Доля перехода от `from` (0) к `to` (1) для зума, который убывает. */
function rampDown(zoom: number, from: number, to: number): number {
  'worklet';
  return smoothstep((from - zoom) / (from - to));
}

/** Непрозрачность ночного неба, которое скрывает плоскую карту. */
export function spaceOpacity(zoom: number): number {
  'worklet';
  return rampDown(zoom, GLOBE_ZOOM_NONE, SPACE_ZOOM_FULL);
}

/** Непрозрачность самого шара. Воркет: зовётся из UI-потока каждый кадр. */
export function globeOpacity(zoom: number): number {
  'worklet';
  return rampDown(zoom, GLOBE_ZOOM_START, GLOBE_ZOOM_FULL);
}

/** Масштаб шара: подрастает вместе с проявлением. */
export function globeScale(zoom: number): number {
  'worklet';
  return GLOBE_SCALE_START + (1 - GLOBE_SCALE_START) * globeOpacity(zoom);
}

/**
 * Точка на сфере -> точка на экране.
 *
 * Точки за горизонтом не выбрасываются, а прижимаются к краю диска.
 * Иначе материк, уходящий за шар, замкнулся бы хордой через середину
 * планеты — Евразия бы «схлопнулась» на глазах при повороте.
 */
export function projectGlobe(lng: number, lat: number, view: GlobeView): GlobePoint {
  const phi = lat * RAD;
  const phi0 = view.lat0 * RAD;
  const dLambda = (lng - view.lng0) * RAD;

  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const sinPhi0 = Math.sin(phi0);
  const cosPhi0 = Math.cos(phi0);
  const cosD = Math.cos(dLambda);

  // cosC — косинус углового расстояния до центра диска: >= 0 значит
  // «на видимой половине».
  const cosC = sinPhi0 * sinPhi + cosPhi0 * cosPhi * cosD;

  let x = cosPhi * Math.sin(dLambda);
  let y = cosPhi0 * sinPhi - sinPhi0 * cosPhi * cosD;

  const front = cosC >= 0;
  if (!front) {
    const len = Math.hypot(x, y);
    if (len > 0) {
      x /= len;
      y /= len;
    }
  }

  // Ось Y на экране растёт вниз, на глобусе север — вверх.
  return { x: view.cx + x * view.r, y: view.cy - y * view.r, front };
}

/** Видна ли хоть часть кольца: если нет, его можно не рисовать вовсе. */
export function ringVisible(ring: readonly number[], view: GlobeView): boolean {
  for (let i = 0; i < ring.length; i += 2) {
    if (projectGlobe(ring[i]!, ring[i + 1]!, view).front) return true;
  }
  return false;
}

/** Меридианы и параллели через каждые `stepDeg` градусов — как линии на глобусе. */
export function graticule(stepDeg = 30): number[][] {
  const lines: number[][] = [];

  for (let lng = -180; lng < 180; lng += stepDeg) {
    const line: number[] = [];
    for (let lat = -80; lat <= 80; lat += 5) line.push(lng, lat);
    lines.push(line);
  }

  for (let lat = -60; lat <= 60; lat += stepDeg) {
    const line: number[] = [];
    for (let lng = -180; lng <= 180; lng += 5) line.push(lng, lat);
    lines.push(line);
  }

  return lines;
}
