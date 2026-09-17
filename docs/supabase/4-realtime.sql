-- Часть 4 из 4: подписка realtime
--
-- Выполняйте по порядку, каждую часть отдельным запросом: так видно,
-- какая именно не прошла. Повторный запуск любой части безопасен.
--
-- Полный скрипт одним куском — docs/supabase.sql.

-- --------------------------------------------------------------- realtime

-- Без этого клиент не получит push об изменении: подписка молча ничего
-- не будет присылать, и позиции друзей обновятся только при перезаходе.
--
-- friendships здесь по той же причине: без неё экран не узнает, что друг
-- только что ввёл твой код, — список обновится лишь при следующем открытии.
-- Повторное добавление таблицы в публикацию — ошибка, поэтому проверяем:
-- скрипт должен оставаться идемпотентным.
do $realtime$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'positions'
  ) then
    alter publication supabase_realtime add table public.positions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'place_visits'
  ) then
    alter publication supabase_realtime add table public.place_visits;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'friendships'
  ) then
    alter publication supabase_realtime add table public.friendships;
  end if;
end;
$realtime$;
