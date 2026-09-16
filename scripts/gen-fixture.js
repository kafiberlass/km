/**
 * Генератор демо-трека. Детерминированный: фикстура должна быть
 * воспроизводимой, иначе регрессионные тесты гео-логики бессмысленны.
 *
 *   node scripts/gen-fixture.js
 *
 * Реальные треки записывайте сами и кладите рядом — набор GPX с настоящими
 * артефактами приёма (двор-колодец, метро, окно дома) ценнее любого генератора.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const waypoints = [
  [37.6425, 55.7625], [37.6412, 55.7631], [37.6398, 55.7638], [37.6386, 55.7646],
  [37.6371, 55.7659], [37.6362, 55.7651], [37.6355, 55.7640], [37.6368, 55.7632],
  [37.6385, 55.7624], [37.6402, 55.7616], [37.6421, 55.7609], [37.6440, 55.7601],
  [37.6459, 55.7596], [37.6478, 55.7592], [37.6489, 55.7591], [37.6483, 55.7602],
  [37.6474, 55.7612], [37.6462, 55.7619], [37.6452, 55.7612], [37.6445, 55.7620],
  [37.6438, 55.7628], [37.6430, 55.7624], [37.6425, 55.7625],
];

const M_PER_DEG_LAT = 111320;
const mPerDegLng = (lat) => M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);

function dist(a, b) {
  const dx = (b[0] - a[0]) * mPerDegLng(a[1]);
  const dy = (b[1] - a[1]) * M_PER_DEG_LAT;
  return Math.hypot(dx, dy);
}

let seed = 20260916;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

const STEP_M = 12;
const SPEED_MPS = 1.35;
const start = Date.UTC(2026, 8, 15, 18, 40, 0);

const points = [];
let t = start;

for (let i = 0; i < waypoints.length - 1; i++) {
  const a = waypoints[i];
  const b = waypoints[i + 1];
  const steps = Math.max(1, Math.round(dist(a, b) / STEP_M));
  for (let s = 0; s < steps; s++) {
    const k = s / steps;
    const lng = a[0] + (b[0] - a[0]) * k;
    const lat = a[1] + (b[1] - a[1]) * k;
    const jLat = ((rnd() - 0.5) * 6) / M_PER_DEG_LAT;
    const jLng = ((rnd() - 0.5) * 6) / mPerDegLng(lat);
    const bad = rnd() < 0.025;
    points.push({
      lat: lat + jLat,
      lng: lng + jLng,
      hdop: bad ? 6 + rnd() * 6 : 0.8 + rnd() * 1.2,
      ele: 145 + rnd() * 6,
      time: new Date(t).toISOString(),
    });
    t += Math.round((STEP_M / SPEED_MPS) * 1000);
  }
}

const body = points
  .map(
    (p) =>
      `      <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lng.toFixed(7)}">` +
      `<ele>${p.ele.toFixed(1)}</ele><time>${p.time}</time><hdop>${p.hdop.toFixed(2)}</hdop></trkpt>`,
  )
  .join('\n');

const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="km-fixture-generator" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Чистые пруды, вечер</name>
    <trkseg>
${body}
    </trkseg>
  </trk>
</gpx>
`;

fs.writeFileSync(path.join(root, 'assets/fixtures/walk-chistye-prudy.gpx'), gpx);
fs.writeFileSync(
  path.join(root, 'assets/fixtures/walkChistyePrudy.ts'),
  `/**
 * Демо-трек: вечерняя прогулка вокруг Чистых прудов, ~2.6 км.
 * Сгенерирован детерминированно: scripts/gen-fixture.js
 *
 * Дубликат .gpx в виде модуля: Metro не отдаёт содержимое ассета
 * синхронно, а трек нужен и приложению, и vitest-тестам.
 */

export const WALK_CHISTYE_PRUDY_GPX = ${JSON.stringify(gpx)};
`,
);

console.log(`точек: ${points.length}, длительность: ${Math.round((t - start) / 60000)} мин`);
