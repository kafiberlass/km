/**
 * Рыбки и трава поверх тумана.
 *
 * Рисуются в том же канвасе и той же матрицей, что и туман: несколько
 * path на слой, отдельного кадра они не стоят.
 *
 * Две категории, и разница смысловая, а не декоративная. На открытой
 * земле живность цветная — это награда за пройденное. За кромкой, в
 * тумане, от неё остаётся силуэт в 35%: видно, что там кто-то есть,
 * но кто именно — узнаешь, когда дойдёшь.
 */

import React, { useMemo } from 'react';
import { Group, Path, Skia } from '@shopify/react-native-skia';

import { palette } from '@/core/theme/tokens';

import type { CritterSpot } from './critters';

interface Props {
  spots: readonly CritterSpot[];
  /** Ширина раскрытого коридора: от неё считается размер живности. */
  scaleMerc: number;
}

const FISH_COLORS = [palette.rust, palette.tealBright, palette.ember] as const;

export function Critters({ spots, scaleMerc }: Props) {
  const drawn = useMemo(() => {
    // Рыбы трёх мастей — золотая, аквамарин и лайм, как в макете.
    // Каждая масть отдельным path: у заливки один цвет на путь, и
    // раскрасить кусок внутри общего пути нечем.
    const fish = FISH_COLORS.map(() => Skia.Path.Make());
    const grass = Skia.Path.Make();
    const hidden = Skia.Path.Make();

    for (const spot of spots) {
      const size = scaleMerc * (spot.kind === 'fish' ? 0.2 : 0.16) * (0.75 + spot.seed * 0.5);

      if (spot.hidden) {
        if (spot.kind === 'fish') appendFish(hidden, spot, size);
        else appendGrass(hidden, spot, size);
        continue;
      }

      if (spot.kind === 'fish') {
        appendFish(fish[Math.floor(spot.seed * FISH_COLORS.length) % FISH_COLORS.length]!, spot, size);
      } else {
        appendGrass(grass, spot, size);
      }
    }

    return { fish, grass, hidden };
  }, [spots, scaleMerc]);

  if (spots.length === 0) return null;

  return (
    <Group>
      {/* Силуэт в тумане: видно, что там кто-то есть, — но не кто. */}
      <Path path={drawn.hidden} color={palette.textOnFog} opacity={0.35} />

      <Path path={drawn.grass} color={palette.emberDeep} opacity={0.85} />

      {drawn.fish.map((path, index) => (
        <Path key={FISH_COLORS[index]} path={path} color={FISH_COLORS[index]} opacity={0.9} />
      ))}
    </Group>
  );
}

/**
 * Рыбка: капля тела и треугольный хвост.
 *
 * Развёрнута по seed — косяк, смотрящий в одну сторону, выглядел бы
 * строем, а не живностью.
 */
function appendFish(path: ReturnType<typeof Skia.Path.Make>, spot: CritterSpot, size: number): void {
  const dir = spot.seed > 0.5 ? 1 : -1;
  const x = spot.x;
  const y = spot.y;
  const half = size / 2;

  path.moveTo(x - half * dir, y);
  path.quadTo(x, y - half * 0.62, x + half * dir, y);
  path.quadTo(x, y + half * 0.62, x - half * dir, y);
  path.close();

  // Хвост.
  path.moveTo(x - half * dir, y);
  path.lineTo(x - size * 0.82 * dir, y - half * 0.5);
  path.lineTo(x - size * 0.82 * dir, y + half * 0.5);
  path.close();
}

/** Куст травы: три пера от одной точки. По макету это линия горизонта. */
function appendGrass(path: ReturnType<typeof Skia.Path.Make>, spot: CritterSpot, size: number): void {
  const x = spot.x;
  const y = spot.y;
  const lean = (spot.seed - 0.5) * size * 0.6;

  for (const [offset, height] of [
    [-size * 0.3, size * 0.7],
    [0, size],
    [size * 0.3, size * 0.75],
  ] as const) {
    const rootX = x + offset;
    // Перо, а не линия: у линии нулевая площадь, и заливкой её не видно.
    path.moveTo(rootX - size * 0.07, y);
    path.quadTo(rootX + lean * 0.5, y - height * 0.6, rootX + lean, y - height);
    path.quadTo(rootX + lean * 0.2, y - height * 0.5, rootX + size * 0.07, y);
    path.close();
  }
}
