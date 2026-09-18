#!/usr/bin/env bash
#
# Обновление проекта одной командой.
#
#   npm run update
#
# Зачем отдельный скрипт вместо `git pull`: сборка на телефон запускает
# `npm install`, тот переписывает package-lock.json, и следующий `git pull`
# отказывается работать — «ваши локальные изменения будут перезаписаны».
# Выглядит это как «обновлений нет», хотя они есть.
#
# Скрипт разбирается с этим сам и в конце говорит главное: хватит ли
# перезагрузить приложение или нужна пересборка на телефон.

set -euo pipefail

cd "$(dirname "$0")/.."

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
step() { printf '\n\033[1m→ %s\033[0m\n' "$1"; }
warn() { printf '\033[33m%s\033[0m\n' "$1"; }
fail() { printf '\n\033[31m✗ %s\033[0m\n\n' "$1" >&2; exit 1; }

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
BEFORE="$(git rev-parse HEAD)"

step "Ветка $BRANCH"

step "Убираю то, что мешает обновлению"
# package-lock.json переписывает npm install при каждой сборке. Восстановить
# его из репозитория безопасно: npm install соберёт его заново.
if ! git diff --quiet -- package-lock.json; then
  git checkout -- package-lock.json
  bold "  package-lock.json восстановлен (его меняет сборка, это нормально)"
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  git stash push --message "перед обновлением $(date '+%d.%m %H:%M')" >/dev/null
  warn "  Ваши правки в коде отложены в сторону (git stash)."
  warn "  Вернуть их потом: git stash pop"
fi

step "Забираю обновления"
# Сеть в поездах и кафе рвётся, поэтому несколько попыток с паузой.
delay=2
for attempt in 1 2 3 4 5; do
  if git fetch origin "$BRANCH"; then break; fi
  [ "$attempt" = "5" ] && fail "Не получилось связаться с GitHub. Проверьте интернет и попробуйте ещё раз."
  warn "  Попытка $attempt не удалась, жду ${delay}с"
  sleep "$delay"
  delay=$((delay * 2))
done

git merge --ff-only FETCH_HEAD >/dev/null 2>&1 || fail "Обновление не встало поверх ваших коммитов.
В ветке есть изменения, которых нет на GitHub. Покажите разработчику вывод:
  git log --oneline origin/$BRANCH..HEAD"

AFTER="$(git rev-parse HEAD)"

if [ "$BEFORE" = "$AFTER" ]; then
  bold "
Новых изменений нет — код уже последней версии."
else
  step "Что приехало"
  git log --oneline --no-decorate "$BEFORE..$AFTER" | sed 's/^/  /'
fi

# Нативная часть меняется редко, и только она требует кабеля и пересборки.
NEEDS_REBUILD=0
if [ "$BEFORE" != "$AFTER" ] && ! git diff --quiet "$BEFORE" "$AFTER" -- package.json app.json plugins; then
  NEEDS_REBUILD=1
fi

# Проверяем не «приехало ли новое», а «стоит ли всё, что нужно».
# Обновиться можно и обычным git pull, и тогда сравнивать не с чем:
# ровно так приложение и осталось без expo-image-picker, а Metro
# отказался собирать бандл целиком.
step "Проверяю зависимости"
MISSING="$(node -e '
  const fs = require("fs");
  const deps = Object.keys(require("./package.json").dependencies || {});
  const missing = deps.filter((name) => !fs.existsSync("node_modules/" + name + "/package.json"));
  process.stdout.write(missing.join(" "));
')"

if [ -n "$MISSING" ]; then
  bold "  Не хватает: $MISSING"
  npm install
  # Нативный модуль мало поставить — его надо вкомпилировать в приложение.
  NEEDS_REBUILD=1
else
  bold "  Все на месте"
fi

if [ "$BEFORE" = "$AFTER" ] && [ "$NEEDS_REBUILD" = "0" ]; then
  bold "
Ничего делать не нужно."
  exit 0
fi

if [ "$NEEDS_REBUILD" = "1" ]; then
  cat <<'NOTE'

Нужна пересборка на телефон: поменялась нативная часть приложения.
Подключите телефон кабелем и выполните:

  npm run setup:ios

NOTE
else
  cat <<'NOTE'

Пересборка не нужна — только код на JavaScript.
Перезагрузите приложение: в симуляторе Cmd+R, на телефоне встряхните
его и нажмите Reload. Если приложение открыто через Metro, достаточно:

  npx expo start --dev-client

NOTE
fi
