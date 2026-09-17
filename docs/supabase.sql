-- Скрипт применяется целиком, одной вставкой в SQL Editor.
--
-- Разделители тела функций именованные, вида $link$: редактор Supabase
-- разбивает вставленное на выражения сам и на безымянных разделителях
-- иногда теряет закрывающий, сообщая «unterminated dollar-quoted
-- string». С именованными перепутать нечего.
--
-- Схема для «друзей на карте».
--
-- Как применить: Supabase → проект → SQL Editor → вставить целиком → Run.
-- Скрипт идемпотентный, повторный запуск ничего не сломает.
--
-- Перед этим в Authentication → Providers включите Anonymous sign-ins:
-- регистрации в приложении нет, аккаунт заводится молча при первом запуске.
--
-- Главное решение здесь — политики доступа (RLS). Правило «позицию видит
-- только подтверждённый друг» описано на уровне базы, а не в коде
-- приложения: клиенту нельзя доверять, он у пользователя в руках.

-- ---------------------------------------------------------------- таблицы

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Друг',
  -- Код для связи: короткий, чтобы продиктовать голосом.
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

-- Дружба хранится двумя строками, по одной на направление. Так политики
-- читаются в одну строку и не нуждаются в «или наоборот».
create table if not exists public.friendships (
  user_id uuid not null references auth.users (id) on delete cascade,
  friend_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  constraint no_self_friendship check (user_id <> friend_id)
);

-- Только последняя позиция, без истории: хранить след перемещений на
-- сервере — совсем другой уровень ответственности за данные.
create table if not exists public.positions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.place_visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  type text not null check (type in ('cafe', 'park', 'viewpoint')),
  lat double precision not null,
  lng double precision not null,
  visited_at timestamptz not null default now()
);

create index if not exists place_visits_user_idx on public.place_visits (user_id, visited_at desc);

-- ------------------------------------------------- код приглашения

-- Алфавит без похожих знаков: ноль и «O», единица и «I» неразличимы
-- на слух и в спешке, а код диктуют вслух.
create or replace function public.new_invite_code() returns text
language plpgsql as $code_gen$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
begin
  loop
    candidate := '';
    for _ in 1..6 loop
      candidate := candidate || substr(alphabet, floor(random() * length(alphabet) + 1)::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where invite_code = candidate);
  end loop;
  return candidate;
end;
$code_gen$;

-- Профиль заводится сам при регистрации: отдельного шага «создай профиль»
-- в приложении нет, а без профиля не будет кода для связи.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $new_user$
begin
  insert into public.profiles (id, invite_code)
  values (new.id, public.new_invite_code())
  on conflict (id) do nothing;
  return new;
end;
$new_user$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Связывание по коду. SECURITY DEFINER, потому что вставлять строку
-- дружбы за другого пользователя политики запрещают — и правильно делают.
create or replace function public.link_by_code(code text) returns uuid
language plpgsql security definer set search_path = public as $link$
declare
  target uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select id into target from public.profiles
  where invite_code = upper(regexp_replace(code, '[[:space:]]', '', 'g'));

  if target is null then
    raise exception 'unknown_code';
  end if;
  if target = auth.uid() then
    raise exception 'own_code';
  end if;

  insert into public.friendships (user_id, friend_id)
  values (auth.uid(), target), (target, auth.uid())
  on conflict do nothing;

  return target;
end;
$link$;

grant execute on function public.link_by_code(text) to authenticated;

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

-- --------------------------------------------------------------- realtime

-- Без этого клиент не получит push об изменении: подписка молча ничего
-- не будет присылать, и позиции друзей обновятся только при перезаходе.
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
end;
$realtime$;
