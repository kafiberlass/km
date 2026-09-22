import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

/**
 * Воркет обязан быть объявлен ниже всех воркетов, которые зовёт.
 *
 * Reanimated забирает вызываемые функции в замыкание в момент объявления
 * и увозит их в UI-поток. Функция, объявленная ниже по файлу, к этому
 * моменту ещё не помечена воркетом — и на телефоне вызов падает с
 * «undefined is not a function».
 *
 * Коварство в том, что ни типы, ни тесты, ни сборка этого не видят:
 * на ноутбуке всё зелёное, а приложение вылетает при отдалении карты.
 * Поэтому проверяем сам текст файлов.
 */

const FILES = [
  'src/features/globe/projection.ts',
  'src/core/geo/mercator.ts',
  'src/features/fog/geometry.ts',
];

interface Fn {
  name: string;
  start: number;
  body: string;
  worklet: boolean;
}

function functionsOf(source: string): Fn[] {
  const pattern = /^(?:export )?function ([A-Za-z0-9_]+)/gm;
  const found: { name: string; start: number }[] = [];

  for (const match of source.matchAll(pattern)) {
    found.push({ name: match[1]!, start: match.index! });
  }

  return found.map((fn, index) => {
    const end = index + 1 < found.length ? found[index + 1]!.start : source.length;
    const body = source.slice(fn.start, end);
    return { ...fn, body, worklet: body.includes("'worklet'") };
  });
}

describe('порядок воркетов в файле', () => {
  for (const file of FILES) {
    it(`${file}: воркет объявлен ниже тех, кого зовёт`, () => {
      const source = readFileSync(file, 'utf8');
      const fns = functionsOf(source);
      const worklets = fns.filter((fn) => fn.worklet);

      for (const caller of worklets) {
        for (const callee of worklets) {
          if (callee.name === caller.name) continue;
          if (!new RegExp(`\\b${callee.name}\\s*\\(`).test(caller.body)) continue;

          expect(
            callee.start,
            `${caller.name} зовёт ${callee.name}, объявленный ниже по файлу — ` +
              'на телефоне это «undefined is not a function»',
          ).toBeLessThan(caller.start);
        }
      }
    });
  }
});
