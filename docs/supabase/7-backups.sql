-- Часть 7: резервные копии на сервере
--
-- Выполните это в SQL Editor одним запросом. Повторный запуск безопасен.
--
-- В отличие от аватарок, бакет ЗАКРЫТЫЙ. В копии лежит вся история
-- прогулок — то самое, что мы обещали не выпускать с телефона. Значит,
-- читать её может только тот, чья она есть, и никто больше: ни друзья,
-- ни случайный человек со ссылкой.

insert into storage.buckets (id, name, public)
values ('backups', 'backups', false)
on conflict (id) do update set public = false;

-- Имя файла — идентификатор пользователя: <uid>.json. Отсюда и проверки
-- ниже: сравниваем начало имени с тем, кто пришёл.

drop policy if exists backups_read on storage.objects;
create policy backups_read on storage.objects for select to authenticated
  using (
    bucket_id = 'backups'
    and split_part(name, '.', 1) = auth.uid()::text
  );

drop policy if exists backups_insert on storage.objects;
create policy backups_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'backups'
    and split_part(name, '.', 1) = auth.uid()::text
  );

drop policy if exists backups_update on storage.objects;
create policy backups_update on storage.objects for update to authenticated
  using (
    bucket_id = 'backups'
    and split_part(name, '.', 1) = auth.uid()::text
  );

drop policy if exists backups_delete on storage.objects;
create policy backups_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'backups'
    and split_part(name, '.', 1) = auth.uid()::text
  );
