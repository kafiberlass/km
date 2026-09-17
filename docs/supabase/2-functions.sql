-- Часть 2 из 4: код приглашения и связывание
--
-- Выполняйте по порядку, каждую часть отдельным запросом: так видно,
-- какая именно не прошла. Повторный запуск любой части безопасен.
--
-- Полный скрипт одним куском — docs/supabase.sql.

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
