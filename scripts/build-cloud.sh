#!/usr/bin/env bash
#
# Сборка приложения силами GitHub — одной командой.
#
#   npm run build:cloud
#
# Отличие от npm run build:android: там сборка идёт на серверах Expo и
# тратит их месячную квоту, а она небольшая. Здесь работает машина GitHub,
# у которой своя квота — около 2000 минут в месяц на приватный репозиторий,
# то есть примерно сотня сборок вместо нескольких.
#
# Подпись приложения при этом остаётся прежней, её по-прежнему выдаёт
# Expo. Это не мелочь: Android не ставит приложение поверх старого, если
# подпись другая — пришлось бы удалять и терять накопленное.

set -euo pipefail

cd "$(dirname "$0")/.."

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
step() { printf '\n\033[1m→ %s\033[0m\n' "$1"; }
warn() { printf '\033[33m%s\033[0m\n' "$1"; }
fail() { printf '\n\033[31m✗ %s\033[0m\n\n' "$1" >&2; exit 1; }

WORKFLOW="android.yml"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"

step "Проверяю доступ к GitHub"
command -v gh >/dev/null 2>&1 || fail "Нет программы gh — через неё идёт разговор с GitHub.
Поставить:  brew install gh
Потом войти: gh auth login"

gh auth status >/dev/null 2>&1 || fail "Вход в GitHub не выполнен.
  gh auth login"

# Запускать сборку кнопкой GitHub разрешает только по файлу из главной
# ветки — таково его правило, даже если собрать нужно другую ветку.
# Проверяем заранее, иначе ошибка приходит невнятная.
step "Проверяю, что сборка настроена в главной ветке"
DEFAULT="$(gh repo view --json defaultBranchRef --jq .defaultBranchRef.name 2>/dev/null || echo main)"
if ! gh api "repos/{owner}/{repo}/contents/.github/workflows/$WORKFLOW?ref=$DEFAULT" >/dev/null 2>&1; then
  fail "В главной ветке ($DEFAULT) нет файла сборки.

GitHub разрешает запускать сборку только по файлу из главной ветки.
Перенесите туда свою работу — ветка $BRANCH ушла вперёд, но расходится
с $DEFAULT только новыми коммитами, поэтому это безопасная перемотка:

  git push origin $BRANCH:$DEFAULT

Потом повторите: npm run build:cloud"
fi

step "Отправляю ветку $BRANCH на GitHub"
delay=2
for attempt in 1 2 3 4 5; do
  if git push -u origin "$BRANCH"; then break; fi
  [ "$attempt" = "5" ] && fail "Не получилось связаться с GitHub. Проверьте интернет."
  warn "  Попытка $attempt не удалась, жду ${delay}с"
  sleep "$delay"
  delay=$((delay * 2))
done

step "Запускаю сборку"
gh workflow run "$WORKFLOW" --ref "$BRANCH" \
  || fail "Не удалось запустить сборку.

Если жалуется на секрет EXPO_TOKEN — его нужно положить в настройки
репозитория один раз:
  1. expo.dev → аватар справа сверху → Account settings → Access tokens
     → Create token, скопировать.
  2. На GitHub: Settings → Secrets and variables → Actions
     → New repository secret, имя EXPO_TOKEN, вставить токен.

Токен вставляйте только в это поле на сайте — не в терминал и не в
переписку: всё, что попадает в историю команд, живёт там долго."

# Запуск появляется в списке не мгновенно, поэтому ждём его появления.
step "Жду начала"
RUN=""
for _ in $(seq 1 20); do
  RUN="$(gh run list --workflow="$WORKFLOW" --branch "$BRANCH" --limit 1 \
    --json databaseId --jq '.[0].databaseId' 2>/dev/null || true)"
  [ -n "$RUN" ] && [ "$RUN" != "null" ] && break
  sleep 3
done
[ -n "$RUN" ] && [ "$RUN" != "null" ] || fail "Сборка запустилась, но найти её не удалось.
Посмотрите на сайте: gh run list --workflow=$WORKFLOW"

bold "  Сборка №$RUN"
bold "  Идёт 15–20 минут. Окно можно закрыть: сборка на стороне GitHub,"
bold "  забрать файл потом — npm run apk:cloud"

step "Слежу за ходом"
gh run watch "$RUN" --exit-status || fail "Сборка не удалась.

Посмотреть, на чём споткнулась:
  gh run view $RUN --log-failed"

step "Скачиваю файл"
target="$HOME/Downloads"
gh run download "$RUN" --name km-apk --dir "$target" \
  || fail "Сборка прошла, но скачать файл не вышло. Попробуйте: npm run apk:cloud"

size="$(du -h "$target/km.apk" | cut -f1)"

cat <<NOTE

Готово: $target/km.apk ($size)

Что дальше:
  1. Файл уже в «Загрузках».
  2. Отправьте его маме: Telegram, WhatsApp, почта — как фотографию.
  3. Она открывает файл на телефоне и разрешает установку.

Дальнейшие изменения поедут к ней по воздуху, без сборки: npm run send

NOTE

command -v open >/dev/null 2>&1 && open -R "$target/km.apk" || true
