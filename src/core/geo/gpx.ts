/**
 * Минимальный парсер GPX. Без DOM — в React Native его нет, а тащить
 * xml-парсер ради десяти строк регулярок незачем.
 *
 * Нужен для двух вещей: проигрывания фейковых прогулок в деве
 * и регрессионных тестов гео-логики на записанных реальных треках.
 */

import type { GeoPoint } from './filter';

const TRKPT_RE = /<trkpt\b[^>]*?\blat="(-?[\d.]+)"[^>]*?\blon="(-?[\d.]+)"[^>]*?(\/>|>([\s\S]*?)<\/trkpt>)/g;
const TIME_RE = /<time>([^<]+)<\/time>/;
const ELE_RE = /<ele>(-?[\d.]+)<\/ele>/;
const HDOP_RE = /<hdop>(-?[\d.]+)<\/hdop>/;

export interface ParseGpxOptions {
  /** Точность для точек, где её нет в файле. */
  defaultAccuracyM?: number;
  /** Если в файле нет <time>, точки расставляются с этим шагом. */
  syntheticStepMs?: number;
  /** Начало отсчёта для синтетических меток времени. */
  startedAt?: number;
}

export function parseGpx(xml: string, options: ParseGpxOptions = {}): GeoPoint[] {
  const {
    defaultAccuracyM = 8,
    syntheticStepMs = 1000,
    startedAt = Date.now(),
  } = options;

  const points: GeoPoint[] = [];
  let index = 0;

  TRKPT_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TRKPT_RE.exec(xml)) !== null) {
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const body = match[4] ?? '';
    const timeMatch = TIME_RE.exec(body);
    const parsedTime = timeMatch ? Date.parse(timeMatch[1]!) : NaN;

    const eleMatch = ELE_RE.exec(body);
    const hdopMatch = HDOP_RE.exec(body);

    points.push({
      lat,
      lng,
      // hdop -> метры: грубое, но для фикстур достаточное приближение.
      accuracy: hdopMatch ? Number(hdopMatch[1]) * 5 : defaultAccuracyM,
      timestamp: Number.isFinite(parsedTime) ? parsedTime : startedAt + index * syntheticStepMs,
      altitude: eleMatch ? Number(eleMatch[1]) : null,
    });
    index += 1;
  }

  return points;
}

/** Обратная операция — выгрузить записанный трек, чтобы положить его в фикстуры. */
export function toGpx(points: GeoPoint[], name = 'km-track'): string {
  const body = points
    .map((p) => {
      const ele = p.altitude != null ? `<ele>${p.altitude.toFixed(1)}</ele>` : '';
      const time = `<time>${new Date(p.timestamp).toISOString()}</time>`;
      const hdop = `<hdop>${(p.accuracy / 5).toFixed(2)}</hdop>`;
      return `      <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lng.toFixed(7)}">${ele}${time}${hdop}</trkpt>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="km" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${name}</name>
    <trkseg>
${body}
    </trkseg>
  </trk>
</gpx>
`;
}
