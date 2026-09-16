/**
 * Восход и закат — «уравнение восхода солнца» (NOAA, упрощённая форма).
 *
 * Нужно для ачивки «Ночной бродяга» из макета: считать прогулку ночной
 * по часам («после 21:00») нельзя — в июне в Петербурге в 21:00 ещё день,
 * а в декабре в 16:00 уже ночь.
 *
 * Точность ±2 минуты. Для геймификации этого более чем достаточно.
 */

const MS_PER_DAY = 86_400_000;
const UNIX_EPOCH_JULIAN = 2_440_587.5;
const J2000 = 2_451_545.0;
const RAD = Math.PI / 180;

/** Стандартный зенит для видимого края диска с учётом рефракции. */
const SUN_ALTITUDE_DEG = -0.833;
const OBLIQUITY_DEG = 23.4397;

function toJulian(timestamp: number): number {
  return timestamp / MS_PER_DAY + UNIX_EPOCH_JULIAN;
}

function fromJulian(julian: number): number {
  return (julian - UNIX_EPOCH_JULIAN) * MS_PER_DAY;
}

export interface SunTimes {
  sunrise: number | null;
  sunset: number | null;
  /** Солнечный полдень — есть всегда, даже за полярным кругом. */
  solarNoon: number;
  /** Склонение солнца, градусы. По нему отличается полярный день от ночи. */
  declinationDeg: number;
}

export function sunTimes(timestamp: number, lat: number, lng: number): SunTimes {
  const julian = toJulian(timestamp);
  const n = Math.round(julian - J2000 - 0.0009 + lng / 360);
  const meanSolarTime = n + 0.0009 - lng / 360;

  const M = (357.5291 + 0.98560028 * meanSolarTime) % 360;
  const Mrad = M * RAD;

  const C =
    1.9148 * Math.sin(Mrad) + 0.02 * Math.sin(2 * Mrad) + 0.0003 * Math.sin(3 * Mrad);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const lambdaRad = lambda * RAD;

  const jTransit =
    J2000 + meanSolarTime + 0.0053 * Math.sin(Mrad) - 0.0069 * Math.sin(2 * lambdaRad);

  const sinDec = Math.sin(lambdaRad) * Math.sin(OBLIQUITY_DEG * RAD);
  const cosDec = Math.cos(Math.asin(sinDec));

  const latRad = lat * RAD;
  const cosOmega =
    (Math.sin(SUN_ALTITUDE_DEG * RAD) - Math.sin(latRad) * sinDec) /
    (Math.cos(latRad) * cosDec);

  const solarNoon = fromJulian(jTransit);
  const declinationDeg = Math.asin(sinDec) / RAD;

  // |cos ω| > 1 — полярный день или полярная ночь, события не наступают.
  if (cosOmega > 1 || cosOmega < -1) {
    return { sunrise: null, sunset: null, solarNoon, declinationDeg };
  }

  const omega = Math.acos(cosOmega) / RAD;
  return {
    sunrise: fromJulian(jTransit - omega / 360),
    sunset: fromJulian(jTransit + omega / 360),
    solarNoon,
    declinationDeg,
  };
}

/**
 * Высота солнца в верхней кульминации: 90 - |φ - δ|.
 * Если она ниже горизонта — солнце не восходит вовсе.
 */
export function isPolarNight(lat: number, declinationDeg: number): boolean {
  return Math.abs(lat - declinationDeg) > 90 - SUN_ALTITUDE_DEG;
}

/** Высота в нижней кульминации: |φ + δ| - 90. Выше горизонта — солнце не заходит. */
export function isPolarDay(lat: number, declinationDeg: number): boolean {
  return Math.abs(lat + declinationDeg) > 90 + SUN_ALTITUDE_DEG;
}

/**
 * Темно ли сейчас. В полярный день — нет, в полярную ночь — да,
 * иначе сравниваем с закатом и восходом этих же суток.
 */
export function isAfterSunset(timestamp: number, lat: number, lng: number): boolean {
  const { sunrise, sunset, declinationDeg } = sunTimes(timestamp, lat, lng);

  if (sunrise == null || sunset == null) {
    return isPolarNight(lat, declinationDeg);
  }
  return timestamp >= sunset || timestamp <= sunrise;
}
