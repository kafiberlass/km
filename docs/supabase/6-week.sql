-- Часть 6: неделя с друзьями
--
-- Выполните это в SQL Editor вашего проекта Supabase одним запросом.
-- Повторный запуск безопасен.

-- Сколько человек прошёл за последние семь дней. Считает его собственный
-- телефон и присылает сюда числом — маршруты на сервер по-прежнему
-- не уезжают, только итог.
alter table public.profiles
  add column if not exists week_m integer not null default 0;

-- Когда это число посчитали. Без него нельзя отличить «ходил мало»
-- от «телефон два дня не выходил в сеть», и второе выглядело бы
-- как первое.
alter table public.profiles
  add column if not exists week_at timestamptz;

-- Заодно: типов мест стало больше. Достопримечательности (кремли,
-- мечети, музеи) не проходили прежнюю проверку, и визит в них
-- сервер отвергал.
alter table public.place_visits
  drop constraint if exists place_visits_type_check;

alter table public.place_visits
  add constraint place_visits_type_check
  check (type in ('cafe', 'park', 'viewpoint', 'landmark'));
