/**
 * Генератор травы.
 *
 * Трава рисуется одним path, а не картинкой: так она тянется на любую
 * ширину экрана и весит ноль байт в ассетах. Псевдослучайность
 * детерминированная — при одном и том же seed трава не «пересаживается»
 * между рендерами, иначе она дёргалась бы на каждый ре-рендер шапки.
 */

function lcg(seed: number): () => number {
  let x = seed >>> 0;
  return () => {
    x = (Math.imul(1103515245, x) + 12345) >>> 0;
    return x / 4294967296;
  };
}

export interface GrassOptions {
  width: number;
  /** Линия земли: от неё растут травинки вверх. */
  base: number;
  /** Максимальная высота травинки. */
  height: number;
  seed: number;
  /** Средняя ширина травинки: чем меньше, тем гуще. */
  bladeWidth?: number;
  /** Насколько полоса продолжается вниз за линию земли. */
  foot?: number;
}

export function grassPath({
  width,
  base,
  height,
  seed,
  bladeWidth = 9,
  foot = 16,
}: GrassOptions): string {
  const rnd = lcg(seed);
  const parts: string[] = [`M0 ${base}`];

  let x = 0;
  while (x < width) {
    const bw = bladeWidth * (0.65 + 0.8 * rnd());
    const ht = height * (0.42 + 0.72 * rnd());
    const lean = (rnd() - 0.5) * bw * 0.8;
    parts.push(`L${(x + bw * 0.5 + lean).toFixed(1)} ${(base - ht).toFixed(1)}`);
    parts.push(`L${Math.min(x + bw, width).toFixed(1)} ${base}`);
    x += bw;
  }

  parts.push(`L${width} ${base + foot}`, `L0 ${base + foot}`, 'Z');
  return parts.join(' ');
}
