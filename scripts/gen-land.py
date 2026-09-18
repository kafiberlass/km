"""Генератор src/features/globe/land.ts — контуров суши для глобуса.

Запускается вручную и очень редко:

    curl -sSLo land.json https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson
    python3 scripts/gen-land.py   # рядом с land.json, результат — land.ts

Источник: Natural Earth 110m land, public domain.
"""

import json

src = json.load(open('land.json'))

def ring_area(ring):
    s = 0.0
    for i in range(len(ring) - 1):
        x1, y1 = ring[i]
        x2, y2 = ring[i + 1]
        s += x1 * y2 - x2 * y1
    return abs(s) / 2.0

def simplify(ring, prec=1):
    out = []
    for lng, lat in ring:
        p = (round(lng, prec), round(lat, prec))
        if not out or out[-1] != p:
            out.append(p)
    if len(out) > 1 and out[0] == out[-1]:
        out.pop()
    return out

rings = []
for f in src['features']:
    geom = f['geometry']
    polys = [geom['coordinates']] if geom['type'] == 'Polygon' else geom['coordinates']
    for poly in polys:
        outer = poly[0]                      # дырки (внутренние озёра) нам не нужны
        if ring_area(outer) < 1.0:           # мельче ~1 град² на глобусе не видно
            continue
        s = simplify(outer)
        if len(s) < 4:
            continue
        rings.append(s)

rings.sort(key=lambda r: -len(r))
total = sum(len(r) for r in rings)
print('rings:', len(rings), 'points:', total)

def fmt(v):
    return ('%g' % v)

body = ',\n  '.join(
    '[' + ','.join(fmt(c) for p in r for c in p) + ']'
    for r in rings
)

out = '''/**
 * Контуры суши для глобуса — Natural Earth 110m, public domain.
 *
 * Сгенерировано скриптом, руками не правится. Формат — плоские массивы
 * [lng, lat, lng, lat, ...] с точностью 0.1 градуса: на шаре радиусом
 * в пол-экрана это меньше пикселя, а мегабайт JSON в бандл не тащится.
 * Внутренние кольца (озёра) выброшены, мелкие острова тоже.
 */

export const LAND_RINGS: readonly (readonly number[])[] = [
  %s,
];
''' % body

open('land.ts', 'w').write(out)
print('КБ:', round(len(out) / 1024))
