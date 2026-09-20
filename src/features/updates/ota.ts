/**
 * Обновления «по воздуху».
 *
 * Обычное обновление приложения — это пересборка, кабель и новый файл,
 * который надо кому-то отправить и уговорить установить. Для мамы в
 * другом городе это означает, что она не обновится никогда.
 *
 * expo-updates решает это так: сам код приложения (JavaScript) лежит
 * отдельным свёртком на сервере Expo. Приложение при запуске спрашивает,
 * нет ли свёртка новее, тихо скачивает его и применяет. Ни магазина,
 * ни файлов, ни участия человека.
 *
 * Чего так обновить нельзя — нативную часть: новые разрешения, новые
 * нативные модули, иконку, версию Expo. Для них по-прежнему нужна
 * пересборка. Сторож здесь — runtimeVersion в app.json: приложение берёт
 * только те обновления, у которых он совпадает, поэтому свёрток,
 * рассчитанный на модуль, которого в сборке нет, просто не приедет.
 *
 * Модуль подключается лениво, через require. Он появился в проекте
 * позже самих сборок, и в уже установленном приложении его нативной
 * части может не быть: обычный import полез бы за ней в момент загрузки
 * файла и уронил бы экран целиком.
 */

import type * as UpdatesModule from 'expo-updates';

type Updates = typeof UpdatesModule;

/** Чем закончилась проверка. На каждое состояние — своя фраза человеку. */
export type UpdateResult =
  | 'ready'
  | 'none'
  | 'unsupported'
  | 'offline'
  | 'failed';

function loadUpdates(): Updates | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-updates') as Updates;
  } catch (error) {
    console.warn('[updates] модуль недоступен', error);
    return null;
  }
}

/**
 * Работают ли обновления в этой сборке.
 *
 * Ложь в двух случаях: приложение собрано до того, как обновления
 * настроили, и — всегда — во время разработки, когда код и так приезжает
 * с компьютера по Metro.
 */
export function updatesSupported(): boolean {
  const updates = loadUpdates();
  return updates?.isEnabled === true;
}

/** Что за свёрток кода сейчас работает: строка для экрана «Обновление». */
export function currentUpdateLabel(): string {
  const updates = loadUpdates();
  if (!updates || !updates.isEnabled) return 'Обновления в этой сборке не настроены';

  if (updates.isEmbeddedLaunch) return 'Работает код из самой сборки';

  const created = updates.createdAt;
  return created ? `Обновление от ${formatDate(created.getTime())}` : 'Обновление установлено';
}

function formatDate(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeStyle: 'short' }).format(
      new Date(timestamp),
    );
  } catch {
    return new Date(timestamp).toISOString();
  }
}

/**
 * Сеть или что-то другое.
 *
 * Разница не косметическая: «нет интернета» человек чинит сам и за
 * секунду, а всё остальное чинить ему нечем, и говорить надо иначе.
 */
export function classifyUpdateError(error: unknown): 'offline' | 'failed' {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /network|internet|offline|unreachable|timeout|соединени/i.test(text)
    ? 'offline'
    : 'failed';
}

/** Фраза под кнопкой: одна на каждый исход, без «ошибка 42». */
export function updateMessage(result: UpdateResult): string {
  switch (result) {
    case 'ready':
      return 'Обновление скачано. Перезапустите приложение, чтобы оно применилось';
    case 'none':
      return 'Установлена последняя версия';
    case 'unsupported':
      return 'В этой сборке обновления по воздуху не настроены — нужна пересборка';
    case 'offline':
      return 'Нет связи. Обновление приедет, когда появится интернет';
    case 'failed':
      return 'Не получилось проверить обновления. Попробуйте позже';
  }
}

/** Проверить и, если есть новое, сразу скачать. Применяется перезапуском. */
export async function fetchUpdate(): Promise<UpdateResult> {
  const updates = loadUpdates();
  if (!updates || !updates.isEnabled) return 'unsupported';

  try {
    const check = await updates.checkForUpdateAsync();
    if (!check.isAvailable) return 'none';

    const fetched = await updates.fetchUpdateAsync();
    return fetched.isNew ? 'ready' : 'none';
  } catch (error) {
    console.warn('[updates] проверка не удалась', error);
    return classifyUpdateError(error);
  }
}

/** Перезапустить приложение на уже скачанном обновлении. */
export async function applyUpdate(): Promise<void> {
  const updates = loadUpdates();
  if (!updates || !updates.isEnabled) return;
  await updates.reloadAsync();
}
