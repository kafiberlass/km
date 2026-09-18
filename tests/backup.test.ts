import { describe, expect, it } from 'vitest';

import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  backupFileName,
  parseBackup,
  summarize,
  type BackupData,
} from '@/core/backup/format';

const data: BackupData = {
  format: BACKUP_FORMAT,
  version: BACKUP_VERSION,
  createdAt: 1_700_000_000_000,
  profile: {
    displayName: 'Камила',
    avatar: 'preset:moon',
    level: 15,
    xp: 320,
    streakDays: 6,
    bestStreak: 12,
    lastActiveDate: '2026-03-14',
    timeZone: 'Europe/Moscow',
    originLat: 55.7963,
    originLng: 49.1088,
  },
  sessions: [
    {
      id: 'w-1',
      startedAt: 1,
      endedAt: 2,
      distanceM: 3000,
      durationS: 1800,
      newCells: 40,
      source: 'auto',
      isNight: false,
    },
  ],
  points: [['w-1', 0, 55.79, 49.1, 8, 1]],
  cells: [['8a1f', '861f', 1, 'w-1']],
  achievements: [['first-steps', 1]],
  discoveries: [['osm-node-1', 1]],
};

describe('копия туда и обратно', () => {
  it('переживает запись в файл и чтение', () => {
    const parsed = parseBackup(JSON.stringify(data));
    expect(parsed.status).toBe('ok');
    if (parsed.status === 'ok') expect(parsed.data).toEqual(data);
  });

  it('сводка говорит, что именно восстанавливаем', () => {
    expect(summarize(data)).toEqual({
      createdAt: data.createdAt,
      walks: 1,
      cells: 1,
      points: 1,
      level: 15,
    });
  });

  it('имя файла с датой', () => {
    expect(backupFileName(Date.UTC(2026, 2, 14))).toBe('km-2026-03-14.json');
  });
});

describe('чужие и битые файлы', () => {
  it('не JSON', () => {
    expect(parseBackup('просто текст').status).toBe('not-json');
    expect(parseBackup('').status).toBe('not-json');
  });

  it('JSON, но не наша копия', () => {
    expect(parseBackup('{"hello":1}').status).toBe('not-backup');
    expect(parseBackup('[]').status).toBe('not-backup');
    expect(parseBackup('null').status).toBe('not-backup');
    expect(parseBackup(JSON.stringify({ ...data, format: 'strava' })).status).toBe('not-backup');
  });

  it('копия из будущей версии не угадывается', () => {
    const future = parseBackup(JSON.stringify({ ...data, version: BACKUP_VERSION + 5 }));
    expect(future.status).toBe('too-new');
    if (future.status === 'too-new') expect(future.version).toBe(BACKUP_VERSION + 5);
  });

  it('обрезанный файл не роняет разбор, а теряет только битые строки', () => {
    const broken = parseBackup(
      JSON.stringify({
        ...data,
        points: [['w-1', 0, 55.79, 49.1, 8, 1], ['битая'], null, ['w-1', 0, 1, 2, 3]],
        cells: [['8a1f', '861f', 1, null], 'мусор'],
        achievements: [['ok', 1], ['без времени']],
      }),
    );

    expect(broken.status).toBe('ok');
    if (broken.status !== 'ok') return;
    expect(broken.data.points).toHaveLength(1);
    expect(broken.data.cells).toHaveLength(1);
    expect(broken.data.achievements).toHaveLength(1);
  });

  it('профиль без полей заменяется разумными значениями, а не ломает восстановление', () => {
    const parsed = parseBackup(
      JSON.stringify({ format: BACKUP_FORMAT, version: 1, profile: {} }),
    );

    expect(parsed.status).toBe('ok');
    if (parsed.status !== 'ok') return;
    expect(parsed.data.profile.level).toBe(1);
    expect(parsed.data.profile.timeZone).toBe('UTC');
    expect(parsed.data.sessions).toEqual([]);
  });
});
