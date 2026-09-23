/**
 * Приём ссылки из письма.
 *
 * Слушать её надо на уровне всего приложения, а не на экране аккаунта:
 * письмо открывают через час, через день, с закрытым приложением —
 * и телефон запустит КМ заново, а не вернёт человека на тот экран,
 * где он нажимал «отправить письмо».
 *
 * Экран при этом должен узнать, что вход состоялся, и перестать ждать.
 * Отсюда крошечная рассылка на подписчиков: хранилища здесь не нужно,
 * нужен сам факт «что-то изменилось».
 */

import { useEffect, useState } from 'react';

import { createFriendsProvider, isServerConfigured } from '@/features/friends';

import { parseAuthLink } from './deepLink';

const ORIGIN = { lat: 0, lng: 0 };

export interface AccountEvent {
  ok: boolean;
  message: string;
}

const listeners = new Set<(event: AccountEvent) => void>();

/** Последнее событие: экран мог открыться уже после ссылки. */
let last: AccountEvent | null = null;

function notify(event: AccountEvent): void {
  last = event;
  for (const listener of listeners) listener(event);
}

/**
 * Обработать адрес, которым открыли приложение.
 *
 * Возвращает true, если адрес был про вход: по этому признаку видно,
 * стоит ли вообще что-то показывать человеку.
 */
export async function handleAuthLink(url: string | null | undefined): Promise<boolean> {
  const link = parseAuthLink(url);
  if (link == null) return false;

  if (link.kind === 'error') {
    notify({ ok: false, message: link.message });
    return true;
  }

  if (!isServerConfigured()) return true;

  try {
    const provider = createFriendsProvider(ORIGIN);
    await provider.applySession?.(link.accessToken, link.refreshToken);
    notify({ ok: true, message: 'Вход выполнен' });
  } catch (error) {
    console.warn('[account] сессия из письма не применилась', error);
    notify({ ok: false, message: 'Ссылка не сработала. Запросите письмо заново' });
  }

  return true;
}

/** Подписка для экрана аккаунта. */
export function useAccountEvent(): AccountEvent | null {
  const [event, setEvent] = useState<AccountEvent | null>(last);

  useEffect(() => {
    const listener = (next: AccountEvent) => setEvent(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return event;
}
