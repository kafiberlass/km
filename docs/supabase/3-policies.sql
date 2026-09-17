-- Часть 3 из 4: политики доступа
--
-- Выполняйте по порядку, каждую часть отдельным запросом: так видно,
-- какая именно не прошла. Повторный запуск любой части безопасен.
--
-- Полный скрипт одним куском — docs/supabase.sql.

-- ------------------------------------------------------- политики доступа

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.positions enable row level security;
alter table public.place_visits enable row level security;

-- Вспомогательная проверка: друг ли мне этот пользователь.
create or replace function public.is_friend(other uuid) returns boolean
language sql stable security definer set search_path = public as $is_friend$
  select exists (
    select 1 from public.friendships
    where user_id = auth.uid() and friend_id = other
  );
$is_friend$;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_friend(id));

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists friendships_select on public.friendships;
create policy friendships_select on public.friendships for select
  using (user_id = auth.uid() or friend_id = auth.uid());

drop policy if exists friendships_delete on public.friendships;
create policy friendships_delete on public.friendships for delete
  using (user_id = auth.uid() or friend_id = auth.uid());

drop policy if exists positions_select on public.positions;
create policy positions_select on public.positions for select
  using (user_id = auth.uid() or public.is_friend(user_id));

drop policy if exists positions_write on public.positions;
create policy positions_write on public.positions for insert
  with check (user_id = auth.uid());

drop policy if exists positions_update on public.positions;
create policy positions_update on public.positions for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists positions_delete on public.positions;
create policy positions_delete on public.positions for delete
  using (user_id = auth.uid());

drop policy if exists visits_select on public.place_visits;
create policy visits_select on public.place_visits for select
  using (user_id = auth.uid() or public.is_friend(user_id));

drop policy if exists visits_write on public.place_visits;
create policy visits_write on public.place_visits for insert
  with check (user_id = auth.uid());

drop policy if exists visits_delete on public.place_visits;
create policy visits_delete on public.place_visits for delete
  using (user_id = auth.uid());
