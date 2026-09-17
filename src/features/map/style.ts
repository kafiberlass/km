/**
 * Стиль карты под макет: светлая песчаная земля, бирюзовая сетка улиц.
 *
 * Земля светлая намеренно. Тёмная в макете — это туман, а не карта:
 * открытый коридор показывает песчаную землю с бирюзовыми улицами,
 * закрытое пространство закрашивает слой тумана поверх. Если сделать
 * тёмной саму карту, открытая зона получится такой же тёмной, как
 * закрытая, и смысл механики пропадает.
 *
 * Подписей в макете нет, но без них непонятно, где ты находишься.
 * Компромисс: названия населённых пунктов и районов — да, всё остальное
 * (улицы, дома, магазины) — нет.
 *
 * Источник тайлов — OpenFreeMap (схема OpenMapTiles), бесплатно и без ключа.
 * Когда понадобится независимость — планета собирается planetiler'ом
 * в .pmtiles и кладётся на Cloudflare R2, меняется только TILE_SOURCE_URL.
 *
 * Данные OpenStreetMap под ODbL: атрибуция обязательна и включена ниже.
 */

import type { StyleSpecification } from '@maplibre/maplibre-react-native';

import { palette } from '@/core/theme/tokens';

export const TILE_SOURCE_URL = 'https://tiles.openfreemap.org/planet';

export const ATTRIBUTION = '© OpenStreetMap contributors';

export function buildMapStyle(): StyleSpecification {
  return {
    version: 8,
    name: 'km-retro',
    // Шрифты для подписей раздаёт тот же OpenFreeMap, ключ не нужен.
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      omt: {
        type: 'vector',
        url: TILE_SOURCE_URL,
        attribution: ATTRIBUTION,
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': palette.ground },
      },
      {
        id: 'landcover',
        type: 'fill',
        source: 'omt',
        'source-layer': 'landcover',
        filter: ['in', 'class', 'wood', 'grass', 'farmland'],
        paint: { 'fill-color': '#C2C295', 'fill-opacity': 0.5 },
      },
      {
        id: 'park',
        type: 'fill',
        source: 'omt',
        'source-layer': 'park',
        paint: { 'fill-color': '#B3C79E', 'fill-opacity': 0.65 },
      },
      {
        id: 'water',
        type: 'fill',
        source: 'omt',
        'source-layer': 'water',
        paint: { 'fill-color': '#8FBEB6' },
      },
      {
        id: 'building',
        type: 'fill',
        source: 'omt',
        'source-layer': 'building',
        minzoom: 14,
        paint: { 'fill-color': '#CBAE85', 'fill-opacity': 0.9 },
      },
      {
        id: 'road-minor',
        type: 'line',
        source: 'omt',
        'source-layer': 'transportation',
        filter: ['in', 'class', 'minor', 'service', 'path', 'track'],
        minzoom: 13,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': palette.tealBright,
          'line-opacity': 0.55,
          'line-width': ['interpolate', ['exponential', 1.4], ['zoom'], 13, 0.4, 18, 3],
        },
      },
      {
        id: 'road-major',
        type: 'line',
        source: 'omt',
        'source-layer': 'transportation',
        filter: ['in', 'class', 'motorway', 'trunk', 'primary', 'secondary', 'tertiary'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': palette.teal,
          'line-opacity': 0.85,
          'line-width': ['interpolate', ['exponential', 1.4], ['zoom'], 10, 0.6, 18, 6],
        },
      },
      {
        // Города видно издалека, районы — на прогулочном масштабе, так что
        // подпись на экране есть всегда, на каком бы зуме ни стояла карта.
        id: 'place-labels',
        type: 'symbol',
        source: 'omt',
        'source-layer': 'place',
        filter: ['in', 'class', 'city', 'town', 'village', 'suburb', 'neighbourhood'],
        layout: {
          // name:ru есть не везде, поэтому откатываемся на основное имя.
          'text-field': ['coalesce', ['get', 'name:ru'], ['get', 'name']],
          'text-font': ['Noto Sans Bold'],
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.15,
          'text-max-width': 8,
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            8,
            ['match', ['get', 'class'], 'city', 14, 11],
            16,
            ['match', ['get', 'class'], 'city', 20, 15],
          ],
        },
        paint: {
          'text-color': palette.textDark,
          'text-opacity': 0.8,
          // Обводка цветом земли: подпись читается поверх любых улиц и воды.
          'text-halo-color': palette.ground,
          'text-halo-width': 1.6,
        },
      },
    ],
  };
}
