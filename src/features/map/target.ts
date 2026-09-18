/**
 * Точка, на которую наводят карту через параметры маршрута.
 *
 * Координаты приходят строками: маршрут может открыть кто угодно и с чем
 * угодно — карточка друга, ссылка, старый экран из истории навигации.
 * Поэтому проверяется всё: пустая строка, «undefined» и широта 91 не должны
 * уводить камеру неизвестно куда.
 */

export interface MapTarget {
  lng: number;
  lat: number;
}

export function parseMapTarget(lng?: string, lat?: string): MapTarget | null {
  if (!lng || !lat) return null;

  const parsedLng = Number(lng);
  const parsedLat = Number(lat);

  if (!Number.isFinite(parsedLng) || !Number.isFinite(parsedLat)) return null;
  if (Math.abs(parsedLng) > 180 || Math.abs(parsedLat) > 90) return null;

  return { lng: parsedLng, lat: parsedLat };
}
