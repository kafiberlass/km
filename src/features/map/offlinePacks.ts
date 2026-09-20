/**
 * Карта, скачанная на телефон.
 *
 * Без неё приложение вне дома показывает пустоту: тайлы тянутся из сети,
 * а сети в парке может не быть, да и мобильный интернет в поездке дорог.
 * Скачанная область живёт в собственной базе MapLibre и подставляется
 * автоматически — коду карты про неё знать не нужно.
 *
 * Стиль для скачивания берётся публичный, а не наш собственный: нативной
 * части нужен URL стиля, а наш собран объектом прямо в коде. Тайлы при
 * этом одни и те же (`tiles.openfreemap.org/planet`), а MapLibre хранит
 * их по адресу ресурса — значит, наш стиль отрисует ровно то, что скачано.
 */

import { OfflineManager } from '@maplibre/maplibre-react-native';

import type { LngLat } from '@/core/geo/mercator';

import {
  OFFLINE_MAX_ZOOM,
  OFFLINE_MIN_ZOOM,
  boundsAround,
  countTiles,
  estimateBytes,
  type Bounds,
} from './offlineArea';

const OFFLINE_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

/**
 * Метка наших пакетов.
 *
 * Идентификатор пакету выдаёт нативная часть, найти его по имени нельзя —
 * поэтому свой помечаем в метаданных и ищем по метке. Область у человека
 * одна, вокруг дома, так что пакет тоже один.
 */
const PACK_KIND = 'km-home';

export interface OfflineProgress {
  percentage: number;
  completedTiles: number;
  completedBytes: number;
  done: boolean;
}

export interface OfflineAreaInfo {
  bounds: Bounds;
  tiles: number;
  bytes: number;
}

/** Что именно скачается: считается до нажатия, показывается человеку. */
export function planArea(center: LngLat, radiusKm: number): OfflineAreaInfo {
  const bounds = boundsAround(center, radiusKm);
  const tiles = countTiles(bounds);
  return { bounds, tiles, bytes: estimateBytes(tiles) };
}

async function ourPacks() {
  const packs = await OfflineManager.getPacks();
  return packs.filter((pack) => pack.metadata?.kind === PACK_KIND);
}

export async function currentPackProgress(): Promise<OfflineProgress | null> {
  try {
    const [pack] = await ourPacks();
    if (!pack) return null;

    const status = await pack.status();
    return {
      percentage: status.percentage,
      completedTiles: status.completedTileCount,
      completedBytes: status.completedTileSize,
      done: status.state === 'complete',
    };
  } catch (error) {
    console.warn('[offline] не удалось прочитать состояние карты', error);
    return null;
  }
}

/**
 * Скачать область вокруг дома.
 *
 * Прежний пакет удаляется: две перекрывающиеся области на телефоне —
 * это двойной объём ради тех же улиц.
 */
export async function downloadArea(
  center: LngLat,
  radiusKm: number,
  onProgress: (progress: OfflineProgress) => void,
  onError: (message: string) => void,
): Promise<void> {
  await deleteArea();

  const { bounds } = planArea(center, radiusKm);

  await OfflineManager.createPack(
    {
      mapStyle: OFFLINE_STYLE_URL,
      bounds,
      minZoom: OFFLINE_MIN_ZOOM,
      maxZoom: OFFLINE_MAX_ZOOM,
      metadata: { kind: PACK_KIND, radiusKm, createdAt: Date.now() },
    },
    (_pack, status) => {
      onProgress({
        percentage: status.percentage,
        completedTiles: status.completedTileCount,
        completedBytes: status.completedTileSize,
        done: status.state === 'complete',
      });
    },
    (_pack, error) => onError(error.message),
  );
}

export async function deleteArea(): Promise<void> {
  try {
    for (const pack of await ourPacks()) {
      await OfflineManager.deletePack(pack.id);
    }
  } catch (error) {
    // Пакета не было — это нормальный случай, а не ошибка.
    console.warn('[offline] не удалось удалить скачанное', error);
  }
}
