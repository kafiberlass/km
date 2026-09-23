#!/usr/bin/env bash
#
# Настроить письма проекта Supabase.
#
#   npm run emails
#
# Главное, что делает скрипт, — прописывает адрес, на который письмо
# возвращает человека: km://auth вместо заводского localhost:3000.
# Без этого ссылка из письма открывает пустой браузер, и вход в аккаунт
# не работает вовсе.
#
# Шаблоны писем он тоже пытается применить, но это необязательная часть:
# на бесплатном тарифе со встроенной почтой Supabase менять их запрещает
# и отвечает «email template modification is not available for free tier
# projects». Заводское письмо со ссылкой при этом работает прекрасно —
# приложение умеет принимать ссылку, а не только код.
#
# Токен берётся из переменной окружения или спрашивается здесь же и
# в историю команд не попадает. В переписку его присылать нельзя никогда:
# он открывает доступ ко всем проектам аккаунта.

set -euo pipefail

cd "$(dirname "$0")/.."

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
step() { printf '\n\033[1m→ %s\033[0m\n' "$1"; }
warn() { printf '\033[33m%s\033[0m\n' "$1"; }
fail() { printf '\n\033[31m✗ %s\033[0m\n\n' "$1" >&2; exit 1; }

[ -f .env ] || fail "Нет файла .env — в нём лежит адрес проекта Supabase."

# Адрес вида https://abcdefgh.supabase.co: имя проекта — первая часть.
URL="$(grep -E '^EXPO_PUBLIC_SUPABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '"'"'"' ')"
[ -n "$URL" ] || fail "В .env нет EXPO_PUBLIC_SUPABASE_URL."

REF="$(printf '%s' "$URL" | sed -E 's#^https?://([^.]+)\..*$#\1#')"
[ -n "$REF" ] && [ "$REF" != "$URL" ] || fail "Не разобрал адрес проекта: $URL"

bold "  Проект: $REF"

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  cat <<NOTE

Нужен токен доступа Supabase (он не тот, что в .env — тот только читает данные).

  1. Откройте https://supabase.com/dashboard/account/tokens
  2. Generate new token, любое имя, скопируйте.
  3. Вставьте ниже. На экране он не появится.

NOTE
  printf 'Токен Supabase: '
  read -r -s SUPABASE_ACCESS_TOKEN
  printf '\n'
fi

[ -n "${SUPABASE_ACCESS_TOKEN:-}" ] || fail "Без токена применить шаблоны нельзя."

# Проверки по шагам: «не подошёл токен», «не тот проект» и «не хватает
# прав» лечатся по-разному, а снаружи выглядят одинаково — отказом.
api() {
  curl -sS -w '\n%{http_code}' \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    -H 'Content-Type: application/json' \
    "$@"
}

status_of() { printf '%s' "$1" | tail -1; }
body_of() { printf '%s' "$1" | sed '$d'; }

step "Проверяю токен"
whoami_res="$(api "https://api.supabase.com/v1/projects")" \
  || fail "Не получилось связаться с Supabase. Проверьте интернет."

case "$(status_of "$whoami_res")" in
  2*) ;;
  401)
    fail "Токен не принят.

Похоже, вставлен не тот ключ. Нужен именно токен доступа со страницы
https://supabase.com/dashboard/account/tokens — тот, что начинается
на sbp_. Ключи из .env (anon, service_role) сюда не подходят: они
работают с данными, а не с настройками проекта." ;;
  403)
    warn "  Ответ сервера:"
    printf '%s\n' "$(body_of "$whoami_res")"
    fail "Токен принят, но читать список проектов ему не разрешают.

Так бывает, когда токен создан в аккаунте, который не владеет
организацией. Зайдите на https://supabase.com/dashboard/account/tokens
тем же аккаунтом, которым вы заходите в проект, и создайте токен там." ;;
  *)
    warn "  Ответ сервера:"
    printf '%s\n' "$(body_of "$whoami_res")"
    fail "Неожиданный ответ при проверке токена." ;;
esac

if ! printf '%s' "$(body_of "$whoami_res")" | grep -q "\"$REF\""; then
  warn "  Проекты, доступные этому токену:"
  printf '%s' "$(body_of "$whoami_res")" | node -e '
    let input = "";
    process.stdin.on("data", (chunk) => (input += chunk));
    process.stdin.on("end", () => {
      try {
        for (const project of JSON.parse(input)) {
          process.stdout.write(`    ${project.id}  ${project.name}\n`);
        }
      } catch {
        process.stdout.write("    (список не разобрался)\n");
      }
    });
  ' || true
  fail "Среди них нет проекта $REF из .env.

Либо токен создан в другом аккаунте, либо в .env адрес другого проекта."
fi

bold "  Токен рабочий, проект на месте"

MAGIC="$(cat docs/supabase/emails/magic-link.html)"
CHANGE="$(cat docs/supabase/emails/email-change.html)"

# Адрес возврата — обязательная часть. Схема km объявлена в app.json;
# по ней телефон узнаёт ссылку и открывает приложение вместо браузера.
step "Прописываю адрес возврата"
URLS='{"site_url":"km://auth","uri_allow_list":"km://auth,km://*"}'

response="$(api -X PATCH \
  "https://api.supabase.com/v1/projects/$REF/config/auth" \
  -d "$URLS")" || fail "Не получилось связаться с Supabase. Проверьте интернет."

case "$(status_of "$response")" in
  2*) bold "  km://auth прописан" ;;
  *)
    warn "  Сервер ответил $(status_of "$response"):"
    printf '%s\n' "$(body_of "$response")"
    unset SUPABASE_ACCESS_TOKEN
    fail "Адрес возврата не прописался, а без него ссылка из письма
откроет пустой браузер.

Руками: Authentication → URL Configuration → Site URL → km://auth" ;;
esac

# Шаблоны — необязательная часть: на бесплатном тарифе их менять нельзя.
step "Пробую шаблоны писем"
BODY="$(MAGIC="$MAGIC" CHANGE="$CHANGE" node -e '
  process.stdout.write(
    JSON.stringify({
      mailer_subjects_magic_link: "Вход в КМ",
      mailer_templates_magic_link_content: process.env.MAGIC,
      mailer_subjects_email_change: "Почта для КМ",
      mailer_templates_email_change_content: process.env.CHANGE,
    }),
  );
')"

response="$(api -X PATCH \
  "https://api.supabase.com/v1/projects/$REF/config/auth" \
  -d "$BODY")" || true

templates="$(status_of "$response")"
unset SUPABASE_ACCESS_TOKEN

case "$templates" in
  2*) bold "  Шаблоны применились" ;;
  *)
    bold "  Шаблоны не применились — и это нормально"
    printf '  %s\n' "$(body_of "$response")"
    bold "  На бесплатном тарифе их менять нельзя. Письмо останется"
    bold "  заводским, со ссылкой, а приложение умеет её принимать." ;;
esac

cat <<NOTE

Готово. Ссылка из письма теперь открывает приложение, а не браузер.

Проверить: Профиль → Аккаунт → Привязать почту → письмо → нажать ссылку.
Письмо идёт до минуты и любит попадать в «Промоакции» и спам.

NOTE
