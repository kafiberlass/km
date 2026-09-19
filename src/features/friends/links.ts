/**
 * Кого считать другом по строкам связей.
 *
 * Дружба лежит двумя строками, по одной на направление, а политика доступа
 * пускает к обеим: и туда, где ты `user_id`, и туда, где ты `friend_id`.
 * Если взять `friend_id` из всех доступных строк подряд, в список друзей
 * попадёшь ты сам — и будешь стоять на карте собственной меткой рядом
 * со своей же точкой.
 *
 * Чистая функция: правило короткое, но ошибка в нём выглядит как двойник
 * на карте, и объяснить его без теста тяжело.
 */

export interface FriendshipRow {
  user_id?: string | null;
  friend_id?: string | null;
}

export function friendIdsFrom(rows: readonly FriendshipRow[], selfId: string): string[] {
  const ids = new Set<string>();

  for (const row of rows) {
    // Из строки берём ту сторону, которая не я: направление связи роли
    // не играет, дружба всегда взаимна.
    for (const id of [row.user_id, row.friend_id]) {
      if (typeof id !== 'string' || id.length === 0) continue;
      if (id === selfId) continue;
      ids.add(id);
    }
  }

  return [...ids];
}
