-- Часть 5 из 5: аватарки
--
-- Выполняется отдельным запросом, как и остальные части. Повторный запуск
-- безопасен.
--
-- Аватарка бывает двух видов, и они хранятся по-разному:
--   preset:moon        — готовый значок, это просто строка;
--   photo:https://...  — своя фотография, лежит в Storage, в строке ссылка.
-- Разбирает их приложение, серверу разница не важна.

-- ------------------------------------------------------------- колонка

alter table public.profiles add column if not exists avatar text;

-- ------------------------------------------------------------- хранилище

-- Публичное на чтение: ссылка на аватарку и так попадает к друзьям,
-- а приватный бакет означал бы подписанные ссылки с коротким сроком
-- жизни и обновление их на каждый показ метки.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- ------------------------------------------------------- политики файлов

-- Читать может кто угодно: бакет публичный.
drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects for select
  using (bucket_id = 'avatars');

-- Писать — только свой файл. Имя файла начинается с идентификатора
-- пользователя, поэтому чужую аватарку подменить нельзя.
drop policy if exists avatars_insert on storage.objects;
create policy avatars_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and split_part(name, '.', 1) = auth.uid()::text
  );

drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and split_part(name, '.', 1) = auth.uid()::text
  );

drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and split_part(name, '.', 1) = auth.uid()::text
  );
