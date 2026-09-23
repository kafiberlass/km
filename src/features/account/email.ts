/**
 * Вход по почте: проверки и слова, которыми объясняются отказы.
 *
 * Зачем вообще вход. Аккаунт заводится молча при первом запуске и живёт
 * внутри установки приложения. Разбила телефон, купила новый, поставила
 * приложение — завёлся другой аккаунт: новый код для друзей, и до копии,
 * лежащей на сервере, он не дотянется, потому что копия лежит в папке
 * прежнего. То есть автоматическая копия спасала от разбитого экрана,
 * но не от смены телефона. Почта — то, по чему человека можно узнать
 * на новом устройстве.
 *
 * Пароля нет намеренно: пароль надо придумать и помнить, а забывшие всё
 * равно пойдут восстанавливать его через ту же почту. Шестизначный код
 * из письма — это тот же путь, только без лишнего шага.
 *
 * Здесь только чистые проверки и перевод ошибок на человеческий, без
 * сети и хранилищ — чтобы проверялось тестами.
 */

/** Сколько цифр в коде из письма. */
export const CODE_LENGTH = 6;

/**
 * Приведение адреса к виду, в котором его понимает сервер.
 *
 * Пробелы по краям оставляет автодополнение клавиатуры, а заглавные
 * буквы — телефон, который вежливо начинает предложение с большой.
 * И то и другое превращает «Kamila@Mail.ru» в чужой адрес.
 */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Проверка адреса.
 *
 * Нарочно грубая: настоящую проверку делает письмо, которое или дойдёт,
 * или нет. Здесь ловятся только очевидные опечатки, чтобы человек
 * не ждал письма, которое никто не отправлял.
 */
export function isValidEmail(raw: string): boolean {
  const email = normalizeEmail(raw);
  if (email.length < 5 || email.length > 254) return false;
  if (/\s/.test(email)) return false;

  const parts = email.split('@');
  if (parts.length !== 2) return false;

  const [name, domain] = parts as [string, string];
  if (name.length === 0 || domain.length < 3) return false;
  if (!domain.includes('.')) return false;
  if (domain.startsWith('.') || domain.endsWith('.')) return false;
  if (domain.includes('..')) return false;

  return true;
}

/** Код из письма: шесть цифр и ничего больше. */
export function isValidCode(raw: string): boolean {
  return new RegExp(`^\\d{${CODE_LENGTH}}$`).test(raw.trim());
}

/**
 * Показать адрес, не показывая его целиком.
 *
 * Экран открыт на улице, рядом люди: «k****a@mail.ru» отвечает
 * на вопрос «под каким аккаунтом я вошла», не выдавая адрес соседу.
 */
export function maskEmail(raw: string): string {
  const email = normalizeEmail(raw);
  const at = email.indexOf('@');
  if (at <= 0) return email;

  const name = email.slice(0, at);
  const domain = email.slice(at);

  if (name.length <= 2) return `${name[0]}*${domain}`;
  return `${name[0]}${'*'.repeat(Math.min(name.length - 2, 6))}${name[name.length - 1]}${domain}`;
}

/**
 * Перевод ответа сервера на человеческий.
 *
 * Supabase отвечает по-английски и терминами своей модели: «Email rate
 * limit exceeded», «Token has expired or is invalid». Человеку на улице
 * это не говорит ничего, а вариантов ответа на самом деле немного,
 * и каждый требует своего действия.
 */
export function authMessage(raw: unknown): string {
  const text = String(
    typeof raw === 'string' ? raw : ((raw as { message?: unknown })?.message ?? raw ?? ''),
  ).toLowerCase();

  if (text.includes('rate limit') || text.includes('too many')) {
    return 'Слишком много писем подряд. Подождите час и попробуйте снова';
  }
  if (text.includes('expired')) {
    return 'Код устарел. Запросите новый';
  }
  if (text.includes('invalid') && text.includes('token')) {
    return 'Код не подошёл. Проверьте цифры из письма';
  }
  if (text.includes('already been registered') || text.includes('already registered')) {
    return 'На эту почту уже заведён аккаунт. Войдите в него — история вернётся';
  }
  if (text.includes('user not found') || text.includes('signups not allowed')) {
    return 'На эту почту аккаунта нет. Проверьте адрес';
  }
  if (text.includes('network') || text.includes('fetch')) {
    return 'Нет связи с сервером. Проверьте интернет';
  }

  return 'Не получилось. Попробуйте ещё раз';
}
