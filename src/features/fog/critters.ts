/**
 * Живность на открытой земле: рыбки и трава.
 *
 * Из макета: «Рыбки, трава и вода — не декор. Они появляются там, где
 * туман уже снят, и работают как награда». Отсюда все правила ниже.
 *
 * Места выбираются по самому пройденному пути — значит, живность
 * заведомо внутри раскрытого коридора, и проверять попадание не нужно.
 * Часть уходит наружу, в туман: там она видна силуэтом. Это обещание,
 * что за краем что-то есть.
 *
 * Расстановка детерминированная: никакого Math.random. Иначе рыбки
 * прыгали бы по карте при каждой перерисовке — а перерисовка случается
 * на каждой новой точке трека.
 */

export type CritterKind = 'fish' | 'grass';

export interface CritterSpot {
  x: number;
  y: number;
  kind: CritterKind;
  /** В тумане — силуэтом, на открытой земле — цветом. */
  hidden: boolean;
  /** 0..1: поворот, наклон, оттенок. Своё у каждой особи. */
  seed: number;
}

export interface CritterOptions {
  /** Через сколько точек трека ставить очередную особь. */
  everyNth: number;
  /** Насколько отходить от линии пути, в тех же единицах, что и точки. */
  spread: number;
  /** Больше этого числа не рисуем: карта важнее живности. */
  maxCount: number;
}

export const DEFAULT_CRITTERS: CritterOptions = {
  everyNth: 14,
  spread: 1,
  maxCount: 48,
};

/** Дробное псевдослучайное из целого. Одно и то же число — один и тот же ответ. */
function noise(index: number, salt: number): number {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

export function pickCritters(
  points: readonly { x: number; y: number }[],
  options: CritterOptions = DEFAULT_CRITTERS,
): CritterSpot[] {
  const { everyNth, spread, maxCount } = options;
  if (points.length < 2 || everyNth <= 0 || maxCount <= 0) return [];

  const spots: CritterSpot[] = [];

  for (let i = 1; i < points.length && spots.length < maxCount; i += everyNth) {
    const point = points[i]!;
    const previous = points[i - 1]!;

    // Поперёк пути, а не вдоль: вдоль они выстроились бы в цепочку
    // по самой тропе и читались бы как пунктир, а не как живность.
    const dx = point.x - previous.x;
    const dy = point.y - previous.y;
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length;
    const ny = dx / length;

    const side = noise(i, 1) > 0.5 ? 1 : -1;
    const distance = spread * (0.35 + noise(i, 2) * 0.9);

    // Каждая четвёртая уходит за край раскрытого — туда, где туман.
    const hidden = noise(i, 3) > 0.75;
    const reach = hidden ? distance * 2.6 : distance;

    spots.push({
      x: point.x + nx * side * reach,
      y: point.y + ny * side * reach,
      // Трава чаще рыбы: земли на прогулке всегда больше, чем воды.
      kind: noise(i, 4) > 0.62 ? 'fish' : 'grass',
      hidden,
      seed: noise(i, 5),
    });
  }

  return spots;
}
