/**
 * Стиль карты под макет: тёмно-коричневая земля, бирюзовая сетка улиц,
 * без подписей. Подписи выключены сознательно — в макете их нет, и они
 * ломали бы ощущение «неизведанной территории».
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
        paint: { 'background-color': palette.fogSoft },
      },
      {
        id: 'landcover',
        type: 'fill',
        source: 'omt',
        'source-layer': 'landcover',
        filter: ['in', 'class', 'wood', 'grass', 'farmland'],
        paint: { 'fill-color': '#33372A', 'fill-opacity': 0.55 },
      },
      {
        id: 'park',
        type: 'fill',
        source: 'omt',
        'source-layer': 'park',
        paint: { 'fill-color': '#2F4034', 'fill-opacity': 0.6 },
      },
      {
        id: 'water',
        type: 'fill',
        source: 'omt',
        'source-layer': 'water',
        paint: { 'fill-color': '#1D3A3A' },
      },
      {
        id: 'building',
        type: 'fill',
        source: 'omt',
        'source-layer': 'building',
        minzoom: 14,
        paint: { 'fill-color': palette.ink, 'fill-opacity': 0.45 },
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
          'line-color': palette.teal,
          'line-opacity': 0.45,
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
          'line-color': palette.tealBright,
          'line-opacity': 0.7,
          'line-width': ['interpolate', ['exponential', 1.4], ['zoom'], 10, 0.6, 18, 6],
        },
      },
    ],
  };
}
