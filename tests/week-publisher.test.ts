import { describe, expect, it } from 'vitest';

import { WEEK_PUBLISH_EVERY_MS, shouldPublishWeek } from '@/features/friends/publish';

const NOW = 1_780_000_000_000;

describe('когда отправлять свою неделю', () => {
  it('в первый раз — сразу', () => {
    expect(shouldPublishWeek(null, NOW, false)).toBe(true);
  });

  it('только что отправляли — не дёргаем сеть', () => {
    expect(shouldPublishWeek(NOW - 60_000, NOW, false)).toBe(false);
  });

  it('прошло три часа — пора', () => {
    expect(shouldPublishWeek(NOW - WEEK_PUBLISH_EVERY_MS, NOW, false)).toBe(true);
  });

  it('после прогулки — независимо от времени', () => {
    // Иначе друг увидит число без только что пройденных километров,
    // а это ровно тот момент, когда его хочется показать.
    expect(shouldPublishWeek(NOW - 1000, NOW, true)).toBe(true);
  });
});
