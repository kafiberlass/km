/**
 * Разбор ссылки из письма.
 *
 * Почему ссылка, а не код: на бесплатном тарифе Supabase шаблоны писем
 * менять нельзя — ни из панели, ни через API, он прямо отвечает «email
 * template modification is not available for free tier projects».
 * А шестизначный код берётся как раз из шаблона. Значит, письмо всегда
 * заводское, то есть со ссылкой, и подтверждать надо ею.
 *
 * Ссылка ведёт на сервер Supabase, тот проверяет её и перебрасывает
 * человека на адрес приложения (`km://auth`), дописывая к нему выданную
 * сессию. Телефон видит знакомую схему и открывает КМ.
 *
 * Здесь только разбор адреса — без сети и без хранилищ, чтобы
 * проверялось тестами. Разбирать приходится обе половины адреса:
 * сессия приезжает после решётки, а отказ — обычно в параметрах.
 */

export type AuthLink =
  | { kind: 'session'; accessToken: string; refreshToken: string }
  | { kind: 'error'; message: string }
  | null;

/** Пары `ключ=значение` из куска адреса после ? или #. */
function params(part: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const pair of part.split('&')) {
    if (pair.length === 0) continue;
    const eq = pair.indexOf('=');
    const key = eq < 0 ? pair : pair.slice(0, eq);
    const value = eq < 0 ? '' : pair.slice(eq + 1);
    try {
      map.set(decodeURIComponent(key), decodeURIComponent(value.replace(/\+/g, ' ')));
    } catch {
      // Битая кодировка — не повод уронить разбор всей ссылки.
      map.set(key, value);
    }
  }
  return map;
}

export function parseAuthLink(url: string | null | undefined): AuthLink {
  if (!url) return null;

  const hash = url.indexOf('#');
  const query = url.indexOf('?');

  const all = new Map<string, string>();
  if (query >= 0) {
    const end = hash > query ? hash : url.length;
    for (const [key, value] of params(url.slice(query + 1, end))) all.set(key, value);
  }
  if (hash >= 0) {
    for (const [key, value] of params(url.slice(hash + 1))) all.set(key, value);
  }

  // Отказ разбираем первым и по любому из трёх признаков: Supabase
  // кладёт его то в error, то в error_code, то в error_description,
  // и ждать конкретного — значит принять отказ за удачный вход.
  const code = all.get('error_code');
  const error = all.get('error_description') ?? all.get('error');
  if ((code != null && code.length > 0) || (error != null && error.length > 0)) {
    return { kind: 'error', message: errorMessage(code ?? error ?? '') };
  }

  const accessToken = all.get('access_token');
  const refreshToken = all.get('refresh_token');
  if (accessToken != null && refreshToken != null && accessToken.length > 0) {
    return { kind: 'session', accessToken, refreshToken };
  }

  return null;
}

/**
 * Отказы, которые случаются на самом деле.
 *
 * Их всего два: ссылку открыли поздно и ссылку открыли второй раз.
 * Оба лечатся одинаково — попросить письмо заново, — но сказать об этом
 * надо по-человечески, а не «otp_expired».
 */
function errorMessage(code: string): string {
  const text = code.toLowerCase();

  if (text.includes('expired')) {
    return 'Ссылка устарела. Запросите письмо заново';
  }
  if (text.includes('access_denied') || text.includes('used')) {
    return 'Ссылка уже использована. Запросите письмо заново';
  }

  return 'Ссылка не сработала. Запросите письмо заново';
}
