/**
 * Что делать с аватаркой при отправке друзьям.
 *
 * Готовый значок — это просто строка, её достаточно записать в профиль.
 * Своя фотография лежит файлом на телефоне, и ссылка на локальный файл
 * друзьям бесполезна: её надо сначала загрузить в хранилище, а в профиль
 * записать уже адрес загруженного.
 *
 * Решение вынесено в чистую функцию: развилка короткая, но ошибка в ней
 * означает либо битую картинку у друга, либо лишнюю загрузку мегабайта
 * на каждое сохранение профиля.
 */

import { parseAvatar } from '@/features/profile/avatars';

export type AvatarSyncPlan =
  /** Записать строку как есть: готовый значок или уже загруженная ссылка. */
  | { kind: 'store'; value: string | null }
  /** Сначала загрузить файл, потом записать адрес. */
  | { kind: 'upload'; uri: string };

export function planAvatarSync(value: string | null): AvatarSyncPlan {
  if (!value) return { kind: 'store', value: null };

  const avatar = parseAvatar(value);
  if (avatar.kind === 'preset') return { kind: 'store', value };

  // Уже загруженная фотография: в строке адрес, а не путь к файлу.
  // Загружать её второй раз незачем — это тот же байт в байт файл.
  if (/^https?:\/\//i.test(avatar.uri)) return { kind: 'store', value };

  return { kind: 'upload', uri: avatar.uri };
}

/** Имя файла в хранилище: по нему же политика проверяет, что файл твой. */
export function avatarFileName(userId: string): string {
  return `${userId}.jpg`;
}
