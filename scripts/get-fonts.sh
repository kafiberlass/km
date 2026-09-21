#!/usr/bin/env bash
#
# Скачать шрифты оформления.
#
#   npm run fonts
#
# Из моей среды шрифтовые хранилища закрыты, поэтому файлы качаются
# здесь, на вашей машине. После этого скажите мне — я включу их
# в приложение одной правкой.
#
# Оба шрифта под открытой лицензией OFL: встраивание в приложение
# разрешено.

set -euo pipefail

cd "$(dirname "$0")/.."

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
step() { printf '\n\033[1m→ %s\033[0m\n' "$1"; }
warn() { printf '\033[33m%s\033[0m\n' "$1"; }

DIR="assets/fonts"
mkdir -p "$DIR"

BASE="https://raw.githubusercontent.com/google/fonts/main"

# Titillium Web — шрифт из макета. Кириллицы в нём нет, поэтому русские
# заголовки им не набрать; качаем, чтобы вы увидели разницу своими глазами.
#
# Exo 2 — замена с кириллицей и тем же характером: геометричный гротеск
# из той же эпохи. Им и будут набраны заголовки.
#
# Source Sans 3 — текст. Кириллица есть, всё в порядке.
FILES="
ofl/titilliumweb/TitilliumWeb-SemiBold.ttf
ofl/exo2/Exo2%5Bwght%5D.ttf
ofl/sourcesans3/SourceSans3%5Bwght%5D.ttf
"

step "Качаю шрифты"
for path in $FILES; do
  name="$(basename "${path}" | sed 's/%5Bwght%5D//')"
  if [ -f "$DIR/$name" ]; then
    bold "  $name уже есть"
    continue
  fi

  if curl -fsSL -o "$DIR/$name" "$BASE/$path"; then
    bold "  $name"
  else
    warn "  не скачался: $name"
  fi
done

step "Что получилось"
ls -1 "$DIR"

cat <<'NOTE'

Готово. Теперь скажите мне — я подключу их к оформлению: шрифты надо
не только положить в папку, но и прописать в коде, а сделать это заранее
нельзя, сборка упала бы на отсутствующих файлах.

NOTE
