/**
 * Адрес сервера и публичный ключ.
 *
 * Читаются из переменных окружения EXPO_PUBLIC_*: Expo подставляет их
 * в бандл на сборке. Ключ anon публичный по замыслу — он и должен лежать
 * в приложении, доступ ограничивают политики базы, а не секретность ключа.
 * Секретный service_role в мобильное приложение не попадает никогда.
 */

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

export interface ServerConfig {
  url: string;
  anonKey: string;
}

/** null — сервер не настроен, приложение работает на демо-друзьях. */
export function serverConfig(): ServerConfig | null {
  if (!url || !anonKey) return null;
  return { url, anonKey };
}
