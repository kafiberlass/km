#!/usr/bin/env bash
#
# Сборка приложения для Android одной командой.
#
#   npm run build:android
#
# Собирает не на компьютере, а на серверах Expo, и это осознанно: локальная
# сборка требует Android Studio, JDK и SDK — десяток гигабайт и отдельный
# вечер настройки. В облаке нужен только аккаунт Expo (бесплатный).
#
# На выходе — файл .apk и ссылка на него. Ссылку можно отправить кому угодно:
# на Android приложение ставится прямо из файла, без магазина, и живёт
# сколько угодно — семидневной подписи, как на iPhone, здесь нет.

set -euo pipefail

cd "$(dirname "$0")/.."

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
step() { printf '\n\033[1m→ %s\033[0m\n' "$1"; }
warn() { printf '\033[33m%s\033[0m\n' "$1"; }
fail() { printf '\n\033[31m✗ %s\033[0m\n\n' "$1" >&2; exit 1; }

step "Проверяю инструмент сборки"
if ! npx --no-install eas --version >/dev/null 2>&1; then
  bold "  Ставлю eas-cli (один раз, пара минут)"
  npm install --global eas-cli || fail "Не удалось поставить eas-cli.
Попробуйте вручную: npm install --global eas-cli
Если ругается на права — sudo npm install --global eas-cli"
fi

step "Проверяю аккаунт Expo"
if ! eas whoami >/dev/null 2>&1; then
  bold "  Нужен вход. Аккаунт бесплатный: если его нет, заведите на expo.dev"
  eas login || fail "Вход не выполнен."
fi
bold "  Вошли как: $(eas whoami 2>/dev/null)"

# Ключи Supabase лежат в .env, а .env не уезжает в облако: он в .gitignore,
# и это правильно. Поэтому те же значения кладём в переменные окружения
# проекта на стороне Expo — иначе собранное приложение покажет демо-друзей
# вместо настоящих.
step "Передаю ключи Supabase в облако сборки"
if [ -f .env ]; then
  while IFS='=' read -r key value; do
    case "$key" in
      EXPO_PUBLIC_SUPABASE_URL|EXPO_PUBLIC_SUPABASE_ANON_KEY)
        [ -z "${value:-}" ] && continue
        # Тихо: значения не печатаем, хоть ключ и публичный по замыслу.
        eas env:create --name "$key" --value "$value" \
          --environment preview --visibility plaintext --force >/dev/null 2>&1 \
          || warn "  Не удалось записать $key — проверьте вручную: eas env:list"
        bold "  $key передан"
        ;;
    esac
  done < <(grep -E '^EXPO_PUBLIC_SUPABASE' .env || true)
else
  warn "  Файла .env нет: приложение соберётся с демо-друзьями."
fi

step "Собираю (10–20 минут, можно закрыть терминал)"
bold "  Прогресс и ссылка на готовый файл — на expo.dev, в разделе Builds."
eas build --platform android --profile preview

cat <<'NOTE'

Готово. Что дальше:

  1. Скачайте .apk по ссылке выше (или на expo.dev → Builds).
  2. Отправьте файл тому, кому ставим: почтой, мессенджером, как угодно.
  3. На Android-телефоне открыть файл и разрешить установку
     из этого источника, когда система спросит.

Обновление: собрать заново и отправить новый файл. Android, в отличие
от iPhone, ничего не отзывает — приложение работает, пока его не удалят.

NOTE
