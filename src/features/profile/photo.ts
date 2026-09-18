/**
 * Своя фотография на аватар.
 *
 * Картинка копируется в папку приложения, а не используется по ссылке
 * из галереи: выбранный файл лежит во временной папке, и система вправе
 * вычистить её в любой момент — аватар тогда просто исчезнет.
 *
 * Имя файла с отметкой времени: под одним и тем же именем новая картинка
 * не показалась бы, потому что её закешировал бы сам <Image>.
 */

import { parseAvatar, photoAvatarValue } from './avatars';

type PickerModule = typeof import('expo-image-picker');
type FileSystemModule = typeof import('expo-file-system');

/**
 * Модуль подгружается лениво, а не обычным import наверху файла.
 *
 * expo-image-picker ищет свою нативную часть в момент загрузки модуля,
 * а не в момент вызова. Пока приложение не пересобрано, обычный import
 * роняет весь экран профиля целиком — с сообщением про «missing default
 * export», по которому ни за что не догадаться, что дело в пересборке.
 *
 * Так исключение приходит туда, где его можно объяснить человеку: в момент
 * нажатия на кнопку. Правило общее для любого нативного модуля, который
 * добавляют после того, как приложение уже стоит на телефоне: код приезжает
 * мгновенно, нативная часть — только с кабелем, и между этими моментами
 * приложение обязано оставаться живым.
 */
function loadPicker(): PickerModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-image-picker') as PickerModule;
}

/** По той же причине, что и выбор фотографий: работа с файлами — тоже нативная. */
function loadFileSystem(): FileSystemModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-file-system') as FileSystemModule;
}

const FOLDER = 'avatars';

export type PickResult =
  | { status: 'saved'; value: string }
  | { status: 'cancelled' }
  | { status: 'denied' }
  /** Пакет стоит, но в собранное приложение он не попал — нужна пересборка. */
  | { status: 'needs-rebuild' }
  | { status: 'failed'; error: unknown };

/**
 * Отличить «нет нативного модуля» от любой другой поломки.
 *
 * Обновление кода приезжает мгновенно, а нативная часть — только с кабелем
 * и пересборкой. В промежутке выбор фотографии падает, и человек должен
 * прочитать «нужна пересборка», а не «что-то пошло не так».
 */
function isMissingNativeModule(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /native module|nativemodule|not installed|has not been linked/i.test(message);
}

/**
 * Показать галерею и сохранить выбранное.
 *
 * `previous` — прежнее значение аватара: если это была фотография,
 * её файл удаляется. Иначе папка растёт с каждой заменой.
 */
export async function pickAvatarPhoto(previous: string | null): Promise<PickResult> {
  try {
    const ImagePicker = loadPicker();

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return { status: 'denied' };

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      // Квадратная обрезка прямо в системном окне: кружок аватара всё равно
      // квадратный, и лучше пусть человек сам выберет, что в него попадёт.
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (picked.canceled || !picked.assets[0]) return { status: 'cancelled' };

    const { Directory, File, Paths } = loadFileSystem();

    const directory = new Directory(Paths.document, FOLDER);
    if (!directory.exists) directory.create({ intermediates: true });

    const target = new File(directory, `avatar-${Date.now()}.jpg`);
    new File(picked.assets[0].uri).copy(target);

    removePhoto(previous);

    return { status: 'saved', value: photoAvatarValue(target.uri) };
  } catch (error) {
    if (isMissingNativeModule(error)) return { status: 'needs-rebuild' };
    return { status: 'failed', error };
  }
}

/** Удалить файл прежней фотографии, если он был. */
export function removePhoto(value: string | null): void {
  const avatar = parseAvatar(value);
  if (avatar.kind !== 'photo') return;

  try {
    const { File } = loadFileSystem();
    const file = new File(avatar.uri);
    if (file.exists) file.delete();
  } catch {
    // Не смогли удалить — не беда: лишний файл на пару десятков килобайт
    // не повод падать при смене аватара.
  }
}
