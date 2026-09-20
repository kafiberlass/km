#!/usr/bin/env bash
#
# Забрать собранный файл приложения для Android.
#
#   npm run apk
#
# Находит последнюю сборку, скачивает её в «Загрузки» и печатает путь.
# Существует потому, что искать файл на сайте — отдельное приключение:
# личный кабинет, проект, раздел сборок, нужная строка, кнопка. Всё это
# делается одной командой, а дальше файл отправляется как любая фотография.

set -euo pipefail

cd "$(dirname "$0")/.."

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
step() { printf '\n\033[1m→ %s\033[0m\n' "$1"; }
fail() { printf '\n\033[31m✗ %s\033[0m\n\n' "$1" >&2; exit 1; }

step "Ищу последнюю сборку"
raw="$(eas build:list --platform android --limit 1 --json --non-interactive 2>/dev/null || true)"
[ -n "$raw" ] || fail "Не удалось получить список сборок.

Проверьте, что вы вошли в тот же аккаунт, где собирали:
  eas whoami"

info="$(printf '%s' "$raw" | node -e '
let input = "";
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  let builds;
  try {
    builds = JSON.parse(input);
  } catch {
    process.exit(2);
  }

  const build = Array.isArray(builds) ? builds[0] : null;
  if (!build) process.exit(3);

  // Имя поля у артефакта менялось от версии к версии, поэтому берём
  // первое подходящее, а не одно жёстко заданное.
  const artifacts = build.artifacts || {};
  const file =
    artifacts.applicationArchiveUrl || artifacts.buildUrl || artifacts.apkUrl || "";

  process.stdout.write([build.status || "", file, build.id || ""].join("\n"));
});
')" || fail "Сборок не нашлось. Сначала соберите приложение: npm run build:android"

status="$(printf '%s' "$info" | sed -n 1p)"
file="$(printf '%s' "$info" | sed -n 2p)"
id="$(printf '%s' "$info" | sed -n 3p)"

bold "  Состояние: ${status:-неизвестно}"

if [ -z "$file" ]; then
  case "$status" in
    *IN_PROGRESS*|*IN_QUEUE*|*NEW*)
      fail "Сборка ещё идёт. Подождите и повторите: npm run apk" ;;
    *ERRORED*|*CANCELED*)
      fail "Последняя сборка не удалась. Соберите заново: npm run build:android" ;;
    *)
      fail "У сборки нет готового файла. Посмотреть подробности:
  eas build:view ${id:-}" ;;
  esac
fi

target="$HOME/Downloads/km.apk"

step "Скачиваю в Загрузки"
curl -L --fail --progress-bar -o "$target" "$file" || fail "Скачать не получилось.
Ссылка на файл, её можно открыть в браузере или отправить как есть:

$file"

size="$(du -h "$target" | cut -f1)"

cat <<NOTE

Готово: $target ($size)

Что дальше:
  1. Откройте «Загрузки» (Finder → Загрузки) — файл km.apk там.
  2. Отправьте его маме: Telegram, WhatsApp, почта — как фотографию.
  3. Она открывает файл на своём телефоне и разрешает установку,
     когда Android спросит.

Можно и без файла: отправьте ей эту ссылку, она скачает сама —
$file

NOTE

# На macOS сразу показываем файл в Finder: так его точно не потерять.
command -v open >/dev/null 2>&1 && open -R "$target" || true
