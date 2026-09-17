-- Проверка: что уже есть в базе.
--
-- Выполняйте между частями — видно, дошла ли предыдущая. После части 1
-- в списке должны быть friendships, place_visits, positions, profiles.

select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
