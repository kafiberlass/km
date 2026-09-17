/**
 * Демо-друзья: три человека, гуляющие вокруг твоей точки.
 *
 * Нужны, чтобы экран можно было делать и проверять без сервера. Позиции
 * двигаются по кругу с разной скоростью — этого хватает, чтобы увидеть,
 * что метки едут за картой и не отстают от тумана.
 */

import { palette } from '@/core/theme/tokens';
import type { LngLat } from '@/core/geo/mercator';

import type { Friend, FriendsProvider, FriendVisit } from './types';

const TICK_MS = 3000;

interface Orbit {
  id: string;
  name: string;
  initials: string;
  color: string;
  /** Радиус круга в градусах широты — примерно 111 км на градус. */
  radiusDeg: number;
  /** Полный оборот за столько миллисекунд. */
  periodMs: number;
  phase: number;
  visits: Array<Omit<FriendVisit, 'id' | 'visitedAt'> & { hoursAgo: number }>;
}

const ORBITS: readonly Orbit[] = [
  {
    id: 'friend-lena',
    name: 'Лена',
    initials: 'ЛК',
    color: palette.plum,
    radiusDeg: 0.004,
    periodMs: 90_000,
    phase: 0,
    visits: [
      { lat: 0.0035, lng: 0.0052, title: 'Кофейня «Ветер»', type: 'cafe', hoursAgo: 3 },
      { lat: -0.0028, lng: 0.0041, title: 'Парк «Сосны»', type: 'park', hoursAgo: 26 },
    ],
  },
  {
    id: 'friend-marat',
    name: 'Марат',
    initials: 'МГ',
    color: palette.teal,
    radiusDeg: 0.0065,
    periodMs: 140_000,
    phase: 2.1,
    visits: [
      { lat: 0.0051, lng: -0.0036, title: 'Старая башня', type: 'viewpoint', hoursAgo: 8 },
    ],
  },
  {
    id: 'friend-dasha',
    name: 'Даша',
    initials: 'ДС',
    color: palette.gold,
    radiusDeg: 0.0028,
    periodMs: 60_000,
    phase: 4.0,
    visits: [
      { lat: -0.0044, lng: -0.0025, title: 'Набережная', type: 'park', hoursAgo: 51 },
    ],
  },
];

function buildFriends(origin: LngLat, at: number): Friend[] {
  // Долгота сжимается с широтой: без косинуса круг превратился бы в эллипс,
  // а друзья на севере разъехались бы по горизонтали.
  const lngScale = 1 / Math.cos((origin.lat * Math.PI) / 180);

  return ORBITS.map((orbit) => {
    const angle = orbit.phase + (2 * Math.PI * at) / orbit.periodMs;

    return {
      id: orbit.id,
      name: orbit.name,
      initials: orbit.initials,
      color: orbit.color,
      position: {
        lat: origin.lat + orbit.radiusDeg * Math.sin(angle),
        lng: origin.lng + orbit.radiusDeg * Math.cos(angle) * lngScale,
        updatedAt: at,
      },
      visits: orbit.visits.map((visit, index) => ({
        id: `${orbit.id}-visit-${index}`,
        title: visit.title,
        type: visit.type,
        lat: origin.lat + visit.lat,
        lng: origin.lng + visit.lng * lngScale,
        visitedAt: at - visit.hoursAgo * 3_600_000,
      })),
    };
  });
}

export class MockFriendsProvider implements FriendsProvider {
  readonly id = 'mock' as const;

  constructor(private readonly origin: LngLat) {}

  subscribe(listener: (friends: Friend[]) => void): () => void {
    listener(buildFriends(this.origin, Date.now()));

    const timer = setInterval(() => {
      listener(buildFriends(this.origin, Date.now()));
    }, TICK_MS);

    return () => clearInterval(timer);
  }
}
