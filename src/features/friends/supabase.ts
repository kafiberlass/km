/**
 * Друзья через Supabase: настоящие люди вместо демо-провайдера.
 *
 * Провайдер делает три вещи:
 *   1. заводит анонимную сессию — регистрации в приложении нет;
 *   2. отдаёт список друзей с их позициями и местами;
 *   3. подписывается на изменения, чтобы точка друга ехала сама.
 *
 * Права проверяет база (см. docs/supabase.sql): клиент запрашивает
 * «все позиции», а видит только те, на которые есть дружба. Так правило
 * невозможно обойти, подменив запрос в приложении.
 */

import 'react-native-url-polyfill/auto';
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';

import type { LngLat } from '@/core/geo/mercator';
import { palette } from '@/core/theme/tokens';

import { serverConfig } from './config';
import { sqliteSessionStorage } from './sessionStorage';
import type { Friend, FriendsProvider, FriendVisit } from './types';

/** Цвет метки. Сервер цветов не хранит — считаем из id, чтобы у друга
 *  он был одинаковым на всех устройствах и не прыгал между запусками. */
const COLORS = [palette.plum, palette.teal, palette.gold, palette.rust, palette.mulberry];

function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return COLORS[hash % COLORS.length] ?? palette.plum;
}

/** Две буквы в кружок: из имени, а при его отсутствии — из кода. */
function initialsOf(name: string, id: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  if (parts.length === 1 && parts[0]!.length >= 2) return parts[0]!.slice(0, 2).toUpperCase();
  return id.slice(0, 2).toUpperCase();
}

interface ProfileRow {
  id: string;
  display_name: string | null;
}
interface PositionRow {
  user_id: string;
  lat: number;
  lng: number;
  updated_at: string;
}
interface VisitRow {
  id: string;
  user_id: string;
  title: string;
  type: FriendVisit['type'];
  lat: number;
  lng: number;
  visited_at: string;
}

export class SupabaseFriendsProvider implements FriendsProvider {
  readonly id = 'server' as const;

  private readonly client: SupabaseClient;

  /**
   * Слушателей несколько — карта и экран друзей, — а канал realtime один.
   * Supabase не даёт добавить обработчики в уже запущенный канал, да и
   * два канала на одни и те же строки означали бы двойные запросы.
   */
  private readonly listeners = new Set<(friends: Friend[]) => void>();
  private channel: RealtimeChannel | null = null;
  private latest: Friend[] = [];

  constructor(url: string, anonKey: string) {
    this.client = createClient(url, anonKey, {
      auth: {
        storage: sqliteSessionStorage,
        persistSession: true,
        autoRefreshToken: true,
        // В мобильном приложении ссылки с токеном в адресной строке нет.
        detectSessionInUrl: false,
      },
    });
  }

  /** Анонимный вход: аккаунт заводится молча при первом запуске. */
  private async ensureSession(): Promise<string | null> {
    const existing = await this.client.auth.getSession();
    if (existing.data.session) return existing.data.session.user.id;

    const created = await this.client.auth.signInAnonymously();
    if (created.error) {
      console.warn('[friends] анонимный вход не удался', created.error.message);
      return null;
    }
    return created.data.user?.id ?? null;
  }

  private async loadFriends(): Promise<Friend[]> {
    const links = await this.client.from('friendships').select('friend_id');
    if (links.error) {
      console.warn('[friends] список друзей не пришёл', links.error.message);
      return [];
    }

    const ids = links.data.map((row) => (row as { friend_id: string }).friend_id);
    if (ids.length === 0) return [];

    // Три запроса вместо джойна: политики доступа всё равно отсекут чужое,
    // а так проще читать и проще переносить на любой другой бэкенд.
    const [profiles, positions, visits] = await Promise.all([
      this.client.from('profiles').select('id, display_name').in('id', ids),
      this.client.from('positions').select('user_id, lat, lng, updated_at').in('user_id', ids),
      this.client
        .from('place_visits')
        .select('id, user_id, title, type, lat, lng, visited_at')
        .in('user_id', ids)
        .order('visited_at', { ascending: false }),
    ]);

    const profileRows = (profiles.data ?? []) as ProfileRow[];
    const positionRows = (positions.data ?? []) as PositionRow[];
    const visitRows = (visits.data ?? []) as VisitRow[];

    return ids.map((friendId) => {
      const profile = profileRows.find((p) => p.id === friendId);
      const position = positionRows.find((p) => p.user_id === friendId);
      const name = profile?.display_name?.trim() || 'Друг';

      return {
        id: friendId,
        name,
        initials: initialsOf(name, friendId),
        color: colorFor(friendId),
        position: position
          ? { lat: position.lat, lng: position.lng, updatedAt: Date.parse(position.updated_at) }
          : null,
        visits: visitRows
          .filter((v) => v.user_id === friendId)
          .map((v) => ({
            id: v.id,
            title: v.title,
            type: v.type,
            lat: v.lat,
            lng: v.lng,
            visitedAt: Date.parse(v.visited_at),
          })),
      } satisfies Friend;
    });
  }

  subscribe(listener: (friends: Friend[]) => void): () => void {
    this.listeners.add(listener);

    // Новый слушатель получает уже известное немедленно: иначе экран
    // висит пустым, пока не придёт следующее обновление.
    if (this.latest.length > 0) listener(this.latest);
    if (!this.channel) this.open();

    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.close();
    };
  }

  private emit(friends: Friend[]): void {
    this.latest = friends;
    for (const listener of this.listeners) listener(friends);
  }

  private refresh(): void {
    void this.loadFriends().then((friends) => {
      if (this.channel) this.emit(friends);
    });
  }

  private open(): void {
    void this.ensureSession().then(() => {
      if (this.channel) this.refresh();
    });

    // Перезапрашиваем список целиком, а не собираем состояние из событий:
    // на десятке друзей это дешевле ошибки в склейке.
    this.channel = this.client
      .channel('friends')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'positions' }, () =>
        this.refresh(),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'place_visits' }, () =>
        this.refresh(),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () =>
        this.refresh(),
      )
      .subscribe();
  }

  private close(): void {
    const channel = this.channel;
    this.channel = null;
    this.latest = [];
    if (channel) void this.client.removeChannel(channel);
  }

  /** Своя позиция. Частоту вызовов решает вызывающий — см. publish.ts. */
  async publishPosition(point: LngLat): Promise<void> {
    const userId = await this.ensureSession();
    if (!userId) return;

    const { error } = await this.client.from('positions').upsert({
      user_id: userId,
      lat: point.lat,
      lng: point.lng,
      updated_at: new Date().toISOString(),
    });
    if (error) console.warn('[friends] позиция не ушла', error.message);
  }

  /** Код, который диктуют другу. */
  async inviteCode(): Promise<string | null> {
    const userId = await this.ensureSession();
    if (!userId) return null;

    const { data, error } = await this.client
      .from('profiles')
      .select('invite_code')
      .eq('id', userId)
      .single();

    if (error) {
      console.warn('[friends] код не пришёл', error.message);
      return null;
    }
    return (data as { invite_code: string }).invite_code;
  }

  /** Связать себя с чужим кодом. Ошибки — человеческим текстом. */
  async linkByCode(code: string): Promise<void> {
    await this.ensureSession();

    const { error } = await this.client.rpc('link_by_code', { code });
    if (!error) return;

    if (error.message.includes('unknown_code')) throw new Error('Код не найден');
    if (error.message.includes('own_code')) throw new Error('Это ваш собственный код');
    if (error.message.includes('not_authenticated')) throw new Error('Нет связи с сервером');
    throw new Error(error.message);
  }

  /**
   * Разорвать дружбу.
   *
   * Удаляются обе строки: связь хранится по одной на направление, и если
   * снести только свою, друг продолжит видеть вашу позицию. Политика это
   * разрешает — в каждой строке одна из сторон вы.
   */
  async removeFriend(friendId: string): Promise<void> {
    const userId = await this.ensureSession();
    if (!userId) throw new Error('Нет связи с сервером');

    const mine = await this.client
      .from('friendships')
      .delete()
      .eq('user_id', userId)
      .eq('friend_id', friendId);
    const theirs = await this.client
      .from('friendships')
      .delete()
      .eq('user_id', friendId)
      .eq('friend_id', userId);

    const error = mine.error ?? theirs.error;
    if (error) throw new Error(error.message);

    // Не ждём события realtime: оно придёт, но список должен обновиться
    // сразу, иначе кнопка выглядит сломанной.
    this.refresh();
  }

  /** Имя, которое увидят друзья. */
  async setDisplayName(name: string): Promise<void> {
    const userId = await this.ensureSession();
    if (!userId) return;
    await this.client.from('profiles').update({ display_name: name }).eq('id', userId);
  }
}

export function createSupabaseProvider(): SupabaseFriendsProvider | null {
  const config = serverConfig();
  return config ? new SupabaseFriendsProvider(config.url, config.anonKey) : null;
}
