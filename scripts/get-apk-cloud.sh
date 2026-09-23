#!/usr/bin/env bash
#
# Забрать файл последней сборки GitHub.
#
#   npm run apk:cloud
#
# Нужен, когда сборку запустили и закрыли окно: npm run build:cloud ждёт
# её до конца, а эта команда просто берёт готовое.

set -euo pipefail

cd "$(dirname "$0")/.."

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
step() { printf '\n\033[1m→ %s\033[0m\n' "$1"; }
fail() { printf '\n\033[31m✗ %s\033[0m\n\n' "$1" >&2; exit 1; }

WORKFLOW="android.yml"

command -v gh >/dev/null 2>&1 || fail "Нет программы gh: brew install gh"

step "Ищу последнюю сборку"
info="$(gh run list --workflow="$WORKFLOW" --limit 1 \
  --json databaseId,status,conclusion \
  --jq '.[0] | "\(.databaseId) \(.status) \(.conclusion)"' 2>/dev/null || true)"
[ -n "$info" ] || fail "Сборок не нашлось. Запустите: npm run build:cloud"

run="$(printf '%s' "$info" | cut -d' ' -f1)"
status="$(printf '%s' "$info" | cut -d' ' -f2)"
verdict="$(printf '%s' "$info" | cut -d' ' -f3)"

bold "  Сборка №$run — $status ${verdict:-}"

case "$status" in
  completed) ;;
  *) fail "Сборка ещё идёт. Подождите и повторите, или следите вживую:
  gh run watch $run" ;;
esac

[ "$verdict" = "success" ] || fail "Сборка не удалась. Подробности:
  gh run view $run --log-failed"

target="$HOME/Downloads"
step "Скачиваю"
gh run download "$run" --name km-apk --dir "$target" || fail "Скачать не получилось."

size="$(du -h "$target/km.apk" | cut -f1)"

cat <<NOTE

Готово: $target/km.apk ($size)

Отправьте файл маме — Telegram, WhatsApp или почтой, как фотографию.
Она открывает его на телефоне и разрешает установку.

NOTE

command -v open >/dev/null 2>&1 && open -R "$target/km.apk" || true
