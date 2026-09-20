import { describe, expect, it } from 'vitest';

import { avatarFileName, planAvatarSync } from '@/features/friends/avatarSync';

describe('что отправлять друзьям', () => {
  it('готовый значок уходит строкой, без загрузок', () => {
    expect(planAvatarSync('preset:moon')).toEqual({ kind: 'store', value: 'preset:moon' });
  });

  it('снятая аватарка стирает и чужую копию', () => {
    expect(planAvatarSync(null)).toEqual({ kind: 'store', value: null });
  });

  it('своя фотография сначала загружается', () => {
    const local = 'photo:file:///data/avatars/avatar-1.jpg';
    expect(planAvatarSync(local)).toEqual({
      kind: 'upload',
      uri: 'file:///data/avatars/avatar-1.jpg',
    });
  });

  it('уже загруженная фотография второй раз не уходит', () => {
    const remote = 'photo:https://project.supabase.co/storage/v1/object/public/avatars/me.jpg';
    expect(planAvatarSync(remote)).toEqual({ kind: 'store', value: remote });
  });

  it('мусор не превращается в загрузку', () => {
    // parseAvatar на непонятной строке отдаёт значок по умолчанию,
    // а значок грузить некуда — и не надо.
    expect(planAvatarSync('что-то не то').kind).toBe('store');
  });

  it('имя файла начинается с идентификатора: по нему проверяется право на запись', () => {
    expect(avatarFileName('abc-123')).toBe('abc-123.jpg');
  });
});
