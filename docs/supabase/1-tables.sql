-- Часть 1 из 4: таблицы
--
-- Выполняйте по порядку, каждую часть отдельным запросом: так видно,
-- какая именно не прошла. Повторный запуск любой части безопасен.
--
-- Полный скрипт одним куском — docs/supabase.sql.

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
