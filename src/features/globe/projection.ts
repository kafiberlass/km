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
 * Переход «карта -> планета»: небо расходится кругом из центра.
 *
 * Сначала было две непересекающиеся фазы: карта гасла в чёрном, и только
 * потом на пустом небе проявлялся шар. Между фазами оставалась щель,
 * в которой не видно ни того ни другого, — синий экран на полсекунды.
 *
 * Одновременное проявление тоже не годится: сквозь полупрозрачный шар
 * просвечивают тайлы, и две картинки накладываются друг на друга.
 *
 * Поэтому небо теперь не заливка во весь экран, а круг, растущий из
 * середины. Карта видна вокруг него всё это время, а шар включается
 * тогда, когда круг уже накрыл место, где шар будет нарисован, — ему
 * не сквозь что просвечивать.
 *
 * Границы: отдаление идёт справа налево, от 5 (страна на экране)
 * до 2.5 (планета целиком).
 */
export const GLOBE_ZOOM_NONE = 5;
/** К этому зуму круг неба разросся на весь экран. */
export const SPACE_ZOOM_FULL = 3.9;
/**
 * С этого зума проявляется сам шар.
 *
 * Не раньше, чем небо накроет его диск: иначе сквозь шар видно карту.
 * И не сильно позже, иначе в середине экрана какое-то время пусто —
 * ровно та щель, из-за которой всё и переделывалось.
 */
export const GLOBE_ZOOM_START = 4.9;
/** К этому зуму шар непрозрачен. */
export const GLOBE_OPAQUE_ZOOM = 4.5;
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
  return rampDown(zoom, GLOBE_ZOOM_START, GLOBE_OPAQUE_ZOOM);
}

/**
 * Радиус круга неба в пикселях.
 *
 * Ноль — небо ещё не начиналось, карта видна целиком. Дальше круг растёт
 * из середины экрана и к SPACE_ZOOM_FULL накрывает даже углы.
 */
export function skyRadius(zoom: number, maxRadiusPx: number): number {
  'worklet';
  return spaceOpacity(zoom) * maxRadiusPx;
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

/*
  Важно: этот воркет зовёт globeScale, поэтому объявлен ПОСЛЕ него.
  Reanimated забирает вызываемые функции в замыкание в момент объявления
  и увозит их в UI-поток. Функция, объявленная ниже по файлу, к этому
  моменту ещё не помечена воркетом, и на телефоне вызов падает с
  «undefined is not a function» — на ноутбуке при этом всё собирается
  и все тесты проходят.
*/
/**
 * Подложка под шаром: тот же круг, но проявляется вместе с ним.
 *
 * Без неё выходит либо тёмный круг раньше планеты (пустой синий экран,
 * из-за которого всё и переделано), либо карта, просвечивающая сквозь
 * полупрозрачный шар. Подложка появляется ровно с той же скоростью, что
 * и сам шар, и обе беды исчезают: в середине экрана всегда планета,
 * вокруг — карта.
 */
export function globeBackdropRadius(zoom: number, discRadiusPx: number): number {
  'worklet';
  return discRadiusPx * globeScale(zoom) * 1.08;
}

/**
 * Точка сферы единичным вектором: север — вверх, нулевой меридиан — на нас.
 *
 * Считается один раз на точку за всё время работы приложения. Смысл
 * в этом: у поворота планеты вся цена — в синусах и косинусах, а они
 * зависят только от самой точки, не от того, каким боком к нам Земля.
 * Вынесли их отсюда — и поворот стал арифметикой.
 */
export function unitOf(lng: number, lat: number): [number, number, number] {
  const phi = lat * RAD;
  const lambda = lng * RAD;
  const cosPhi = Math.cos(phi);
  return [cosPhi * Math.cos(lambda), cosPhi * Math.sin(lambda), Math.sin(phi)];
}

/** Синусы-косинусы поворота планеты: четыре на кадр вместо четырёх на точку. */
export interface GlobeTrig {
  sinLng0: number;
  cosLng0: number;
  sinLat0: number;
  cosLat0: number;
}

export function globeTrig(view: GlobeView): GlobeTrig {
  const lambda0 = view.lng0 * RAD;
  const phi0 = view.lat0 * RAD;
  return {
    sinLng0: Math.sin(lambda0),
    cosLng0: Math.cos(lambda0),
    sinLat0: Math.sin(phi0),
    cosLat0: Math.cos(phi0),
  };
}

/**
 * Единичный вектор -> точка на экране. Ни одного синуса.
 *
 * Точки за горизонтом не выбрасываются, а прижимаются к краю диска.
 * Иначе материк, уходящий за шар, замкнулся бы хордой через середину
 * планеты — Евразия бы «схлопнулась» на глазах при повороте.
 */
export function projectUnit(
  a: number,
  b: number,
  c: number,
  trig: GlobeTrig,
  view: GlobeView,
): GlobePoint {
  // cosPhi * cos(lambda - lambda0) и cosPhi * sin(lambda - lambda0),
  // разложенные по формуле разности углов: в единичном векторе уже лежит
  // всё, что для этого нужно.
  const along = a * trig.cosLng0 + b * trig.sinLng0;
  let x = b * trig.cosLng0 - a * trig.sinLng0;
  let y = trig.cosLat0 * c - trig.sinLat0 * along;

  // cosC — косинус углового расстояния до центра диска: >= 0 значит
  // «на видимой половине».
  const front = trig.sinLat0 * c + trig.cosLat0 * along >= 0;

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

/** То же самое для одиночной точки, заданной широтой и долготой. */
export function projectGlobe(lng: number, lat: number, view: GlobeView): GlobePoint {
  const [a, b, c] = unitOf(lng, lat);
  return projectUnit(a, b, c, globeTrig(view), view);
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
 * Раздвигание плавное, и это главное свойство. Раньше слипшиеся метки
 * раскладывались по кругу вокруг общего центра, и пока они считались
 * слипшимися, расстояние между ними держалось постоянным. Человек
 * приближал карту, настоящее расстояние росло, нарисованное стояло —
 * а в тот момент, когда метки переставали считаться слипшимися, они
 * прыжком съезжались обратно. Здесь метки лишь расталкиваются ровно
 * настолько, насколько им не хватает до зазора: разошлись сами —
 * раздвигать нечего, и прыжку взяться неоткуда.
 */
export function spreadMarkers<T extends { x: number; y: number }>(
  items: readonly T[],
  minGapPx: number,
): T[] {
  'worklet';

  const xs: number[] = [];
  const ys: number[] = [];
  for (const item of items) {
    xs.push(item.x);
    ys.push(item.y);
  }

  // Несколько проходов: раздвинув двоих, можно прижать третьего.
  // Трёх хватает — на планете людей единицы, не сотни.
  for (let pass = 0; pass < 3; pass += 1) {
    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        let dx = xs[j]! - xs[i]!;
        let dy = ys[j]! - ys[i]!;
        let distance = Math.hypot(dx, dy);

        if (distance >= minGapPx) continue;

        if (distance < 0.0001) {
          // Ровно одна точка: направление берём от номера метки, иначе
          // оно зависело бы от порядка в списке и дрожало бы каждый кадр.
          const angle = (2 * Math.PI * i) / Math.max(1, items.length);
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          distance = 1;
        }

        const push = (minGapPx - distance) / 2;
        const ux = (dx / distance) * push;
        const uy = (dy / distance) * push;

        xs[i] = xs[i]! - ux;
        ys[i] = ys[i]! - uy;
        xs[j] = xs[j]! + ux;
        ys[j] = ys[j]! + uy;
      }
    }
  }

  const result: T[] = [];
  for (let i = 0; i < items.length; i += 1) {
    result.push({ ...items[i]!, x: xs[i]!, y: ys[i]! });
  }
  return result;
}
