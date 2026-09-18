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
 * Зум, ниже которого видна только планета, и зум, выше которого её нет.
 *
 * Между ними — плавное перетекание: плоская карта гаснет, шар проявляется.
 * Границы поднимали после первой же проверки на живом телефоне: от масштаба
 * двора до планетарного четырнадцать ступеней зума, и человек, сводя пальцы
 * пять раз подряд, просто не доходил до шара и решал, что его нет.
 * Теперь планета начинает проступать уже на масштабе страны.
 */
export const GLOBE_ZOOM_FULL = 2.5;
export const GLOBE_ZOOM_NONE = 5;

/** Насколько планета непрозрачна на данном зуме. Воркет: зовётся из UI-потока. */
export function globeOpacity(zoom: number): number {
  'worklet';
  if (zoom <= GLOBE_ZOOM_FULL) return 1;
  if (zoom >= GLOBE_ZOOM_NONE) return 0;
  return (GLOBE_ZOOM_NONE - zoom) / (GLOBE_ZOOM_NONE - GLOBE_ZOOM_FULL);
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
