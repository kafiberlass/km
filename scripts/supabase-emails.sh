#!/usr/bin/env bash
#
# Применить шаблоны писем к проекту Supabase.
#
#   npm run emails
#
# Зачем скрипт вместо «зайдите в панель и вставьте два куска текста»:
# шаблоны — часть приложения, а не настройка, которую помнит один человек.
# Приложение ждёт из письма шестизначный код, и если шаблон вернуть
# к заводскому, вход перестанет работать с формулировкой «код не подошёл».
# Пусть лежат в репозитории и накатываются одной командой.
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

MAGIC="$(cat docs/supabase/emails/magic-link.html)"
CHANGE="$(cat docs/supabase/emails/email-change.html)"

step "Собираю запрос"
# Через node, а не склейкой строк: в шаблонах кавычки и переводы строк,
# и руками их экранировать — способ получить сломанный JSON.
BODY="$(MAGIC="$MAGIC" CHANGE="$CHANGE" node -e '
  process.stdout.write(
    JSON.stringify({
      site_url: "km://",
      mailer_subjects_magic_link: "Код для входа в КМ",
      mailer_templates_magic_link_content: process.env.MAGIC,
      mailer_subjects_email_change: "Код для привязки почты",
      mailer_templates_email_change_content: process.env.CHANGE,
    }),
  );
')"

step "Применяю"
response="$(curl -sS -w '\n%{http_code}' -X PATCH \
  "https://api.supabase.com/v1/projects/$REF/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "$BODY")" || fail "Не получилось связаться с Supabase. Проверьте интернет."

code="$(printf '%s' "$response" | tail -1)"
payload="$(printf '%s' "$response" | sed '$d')"

unset SUPABASE_ACCESS_TOKEN

case "$code" in
  2*)
    cat <<NOTE

Готово. Письма теперь приходят с шестизначным кодом, а не со ссылкой.

Проверить: в приложении Профиль → Аккаунт → Привязать почту.
Письмо идёт до минуты и любит попадать в «Промоакции» и спам.

NOTE
    ;;
  401|403)
    fail "Токен не подошёл ($code). Проверьте, что он создан на
https://supabase.com/dashboard/account/tokens и скопирован целиком." ;;
  *)
    warn "Сервер ответил $code:"
    printf '%s\n' "$payload"
    fail "Шаблоны не применились.

Их всегда можно вставить руками: Authentication → Emails → Templates,
шаблоны «Magic Link» и «Change Email Address». Текст лежит в
docs/supabase/emails/." ;;
esac
