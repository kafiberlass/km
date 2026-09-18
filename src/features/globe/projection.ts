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

/**
 * Размер планеты на двух концах: на самом краю отдаления и у границы
 * с плоской картой.
 *
 * Шар обязан вести себя как предмет: приближаешь — становится крупнее,
 * отдаляешь — мельче. Раньше он на приближении просто гас на месте,
 * и это читалось как «планета исчезает, хотя я к ней лечу».
 */
export const GLOBE_SCALE_FAR = 0.72;
export const GLOBE_SCALE_NEAR = 2.6;

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

/**
 * Масштаб шара. Растёт вместе с зумом на всём диапазоне.
 *
 * Два участка. От края отдаления до «планета целиком» (0 -> 2.5) Земля
 * подрастает с маленькой до своего нормального размера — это подлёт.
 * Дальше (2.5 -> 3.7) она продолжает расти и одновременно растворяется,
 * уступая место карте: то же самое чувство, что при входе в атмосферу.
 */
export function globeScale(zoom: number): number {
  'worklet';
  if (zoom <= 0) return GLOBE_SCALE_FAR;
  if (zoom >= GLOBE_ZOOM_START) return GLOBE_SCALE_NEAR;

  if (zoom <= GLOBE_ZOOM_FULL) {
    return GLOBE_SCALE_FAR + (1 - GLOBE_SCALE_FAR) * smoothstep(zoom / GLOBE_ZOOM_FULL);
  }

  const t = (zoom - GLOBE_ZOOM_FULL) / (GLOBE_ZOOM_START - GLOBE_ZOOM_FULL);
  return 1 + (GLOBE_SCALE_NEAR - 1) * smoothstep(t);
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

export interface GlobeMarker<T> {
  item: T;
  x: number;
  y: number;
}

/**
 * Метки на видимой половине планеты.
 *
 * Отдельно от projectGlobe, потому что для меток «прижать к краю диска»
 * — неправильный ответ: материк, уходящий за шар, продолжается там же,
 * а человек, оказавшийся на другой стороне Земли, на краю диска
 * не находится. Такие метки просто не рисуются.
 */
export function globeMarkers<T>(
  items: readonly T[],
  view: GlobeView,
  at: (item: T) => { lng: number; lat: number } | null | undefined,
): GlobeMarker<T>[] {
  const markers: GlobeMarker<T>[] = [];

  for (const item of items) {
    const point = at(item);
    if (!point) continue;

    const projected = projectGlobe(point.lng, point.lat, view);
    if (!projected.front) continue;

    markers.push({ item, x: projected.x, y: projected.y });
  }

  return markers;
}

/**
 * Развести метки, попавшие в одну точку.
 *
 * На шаре радиусом в пол-экрана один градус — это меньше двух пикселей,
 * а люди в одном городе отстоят друг от друга на сотые доли градуса.
 * Без разведения метка друга оказывается ровно под своей: рисуются обе,
 * видно одну, и выглядит это как «друга на планете нет».
 *
 * Слипшиеся метки раскладываются по кругу вокруг общего центра. Точность
 * при этом теряется — но в масштабе планеты её и так нет: важно, что
 * человек рядом, а не в Австралии.
 */
export function spreadMarkers<T extends { x: number; y: number }>(
  items: readonly T[],
  minGapPx: number,
): T[] {
  const result = items.slice();
  const cluster = new Array<number>(items.length).fill(-1);
  const clusters: number[][] = [];

  for (let i = 0; i < items.length; i += 1) {
    if (cluster[i] !== -1) continue;

    const group = [i];
    cluster[i] = clusters.length;

    for (let j = i + 1; j < items.length; j += 1) {
      if (cluster[j] !== -1) continue;
      const distance = Math.hypot(items[j]!.x - items[i]!.x, items[j]!.y - items[i]!.y);
      if (distance >= minGapPx) continue;
      cluster[j] = clusters.length;
      group.push(j);
    }

    clusters.push(group);
  }

  for (const group of clusters) {
    if (group.length < 2) continue;

    const cx = group.reduce((sum, index) => sum + items[index]!.x, 0) / group.length;
    const cy = group.reduce((sum, index) => sum + items[index]!.y, 0) / group.length;

    group.forEach((index, position) => {
      // Первая метка уходит вверх, остальные по часовой стрелке:
      // так порядок не зависит от того, кто первым пришёл в список.
      const angle = (2 * Math.PI * position) / group.length - Math.PI / 2;
      result[index] = {
        ...items[index]!,
        x: cx + Math.cos(angle) * minGapPx,
        y: cy + Math.sin(angle) * minGapPx,
      };
    });
  }

  return result;
}
