#!/usr/bin/env bash
#
# Сторож: забрать новый код, проверить, отправить обновление, при нужде
# собрать apk. Запускается таймером раз в две минуты.
#
# Всё построено на одном правиле: обновление уходит на телефоны только
# после того, как код проверен. Сломанная отправка доезжает до всех
# за минуту, а откатывать её придётся руками — поэтому сначала типы
# и тесты, и только потом публикация.

set -euo pipefail

KM_HOME="/srv/km"
REPO="$KM_HOME/repo"
APK_DIR="$KM_HOME/apk"
BRANCH="${KM_BRANCH:-claude/stoic-allen-6zgmve}"

export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$KM_HOME/android-sdk}"
export ANDROID_HOME="$ANDROID_SDK_ROOT"
export PATH="$ANDROID_SDK_ROOT/platform-tools:$PATH"
# Без этого Metro на маленькой машине упирается в память и падает молча.
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=3072}"

say() { printf '%s %s\n' "$(date '+%H:%M:%S')" "$1"; }

notify() {
  [ -n "${KM_NOTIFY_URL:-}" ] || return 0
  # Адрес задаётся целиком, текст дописывается в конец: так это работает
  # и с телеграмом, и с ntfy, и с чем угодно ещё.
  curl -fsS --max-time 10 --get --data-urlencode "text=$1" "$KM_NOTIFY_URL" >/dev/null 2>&1 || true
}

fail() {
  say "ОШИБКА: $1"
  notify "КМ: сборка не прошла — $1"
  exit 1
}

cd "$REPO"

[ -n "${EXPO_TOKEN:-}" ] || fail "нет EXPO_TOKEN (впишите в /etc/km/env)"

say "смотрю $BRANCH"
git fetch --quiet origin "$BRANCH" || fail "нет связи с GitHub"

BEFORE="$(git rev-parse HEAD)"
AFTER="$(git rev-parse FETCH_HEAD)"

if [ "$BEFORE" = "$AFTER" ]; then
  say "нового нет"
  exit 0
fi

SUBJECT="$(git log -1 --pretty=%s FETCH_HEAD)"
say "приехало: $SUBJECT"

# Нативное меняется редко, и только оно требует новой установки на телефон.
# Всё остальное уезжает обновлением по воздуху.
NATIVE=0
git diff --quiet "$BEFORE" "$AFTER" -- app.json package.json package-lock.json plugins \
  || NATIVE=1

git merge --ff-only FETCH_HEAD >/dev/null || fail "код не встал поверх — в репозитории сервера что-то своё"

if [ "$NATIVE" = "1" ] || [ ! -d node_modules ]; then
  say "ставлю зависимости"
  npm ci --no-audit --no-fund >/dev/null 2>&1 || fail "npm ci не прошёл"
fi

say "проверяю типы"
npx tsc --noEmit || fail "типы не сходятся"

say "прогоняю тесты"
npm test --silent || fail "тесты не прошли"

say "отправляю обновление"
eas update --branch preview --environment preview \
  --message "$SUBJECT" --non-interactive >/dev/null || fail "обновление не отправилось"

say "обновление ушло"

if [ "$NATIVE" = "0" ]; then
  notify "КМ: обновление ушло на телефоны — $SUBJECT"
  exit 0
fi

# Нативное поменялось: обновления по воздуху не хватит, нужен новый файл.
say "меняли нативную часть — собираю apk"
mkdir -p "$APK_DIR"
SHORT="$(git rev-parse --short HEAD)"
OUT="$APK_DIR/km-$SHORT.apk"

eas build --platform android --profile preview --local \
  --non-interactive --output "$OUT" >/dev/null || fail "apk не собрался"

ln -sf "$OUT" "$APK_DIR/km-latest.apk"

# Старые файлы копятся по сотне мегабайт: держим пять последних.
ls -1t "$APK_DIR"/km-*.apk 2>/dev/null | tail -n +6 | xargs -r rm -f

say "apk готов: $OUT"
notify "КМ: нужна переустановка на телефон — $SUBJECT. Файл: http://$(hostname -I | awk '{print $1}'):8088/km-latest.apk"
