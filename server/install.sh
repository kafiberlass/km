#!/usr/bin/env bash
#
# Установка сборочного сервера. Debian 12 (или Ubuntu 24.04), от root.
#
#   bash install.sh
#
# Ставит всё, что нужно, чтобы сервер сам забирал код с GitHub, проверял
# его, отправлял обновление на телефоны и, когда меняется нативная часть,
# собирал apk для Android.
#
# Скрипт можно запускать повторно: он ничего не ломает и доставляет
# недостающее.

set -euo pipefail

KM_USER="km"
KM_HOME="/srv/km"
REPO_URL="${REPO_URL:-https://github.com/kafiberlass/km.git}"
BRANCH="${BRANCH:-claude/stoic-allen-6zgmve}"

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
step() { printf '\n\033[1m→ %s\033[0m\n' "$1"; }
fail() { printf '\n\033[31m✗ %s\033[0m\n\n' "$1" >&2; exit 1; }

[ "$(id -u)" = "0" ] || fail "Запускать от root: sudo bash install.sh"

step "Системные пакеты"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git unzip ca-certificates openjdk-17-jdk-headless python3 >/dev/null
bold "  git, java, python — на месте"

step "Node.js 22"
if ! command -v node >/dev/null || [ "$(node -v | cut -c2-3)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
bold "  $(node -v)"

step "eas-cli"
npm install --global eas-cli >/dev/null 2>&1 || fail "Не удалось поставить eas-cli"
bold "  $(eas --version 2>/dev/null | head -1)"

step "Пользователь $KM_USER"
id "$KM_USER" >/dev/null 2>&1 || useradd --system --create-home --home-dir "$KM_HOME" --shell /bin/bash "$KM_USER"
mkdir -p "$KM_HOME/apk" "$KM_HOME/logs"
chown -R "$KM_USER:$KM_USER" "$KM_HOME"
bold "  домашняя папка: $KM_HOME"

step "Android SDK"
# Нужен только для сборки apk прямо здесь. Скачивается один раз, дальше
# лежит и не трогается.
SDK_ROOT="$KM_HOME/android-sdk"
if [ ! -d "$SDK_ROOT/cmdline-tools/latest" ]; then
  mkdir -p "$SDK_ROOT/cmdline-tools"
  TMP="$(mktemp -d)"
  curl -fsSL -o "$TMP/tools.zip" \
    https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip \
    || fail "Не скачались инструменты Android SDK"
  unzip -q "$TMP/tools.zip" -d "$TMP"
  mv "$TMP/cmdline-tools" "$SDK_ROOT/cmdline-tools/latest"
  rm -rf "$TMP"
fi

export ANDROID_SDK_ROOT="$SDK_ROOT"
yes | "$SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" --licenses >/dev/null 2>&1 || true
# NDK и cmake — не роскошь: половина библиотек проекта (база, графика,
# анимации) содержит код на C++, и без них сборка остановится на полпути,
# пожаловавшись на отсутствие компилятора.
"$SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" \
  "platform-tools" "platforms;android-35" "build-tools;35.0.0" \
  "ndk;27.1.12297006" "cmake;3.22.1" >/dev/null 2>&1 \
  || fail "Не установились компоненты Android SDK"
chown -R "$KM_USER:$KM_USER" "$SDK_ROOT"
bold "  $SDK_ROOT"

step "Код проекта"
if [ ! -d "$KM_HOME/repo/.git" ]; then
  sudo -u "$KM_USER" git clone --branch "$BRANCH" "$REPO_URL" "$KM_HOME/repo" \
    || fail "Не удалось скачать код. Если репозиторий закрытый, нужен доступ по ключу — см. README."
else
  bold "  уже есть, обновится сторожем"
fi

step "Настройки"
mkdir -p /etc/km
if [ ! -f /etc/km/env ]; then
  cat > /etc/km/env <<'ENV'
# Токен Expo: expo.dev -> аватар -> Account settings -> Access tokens.
EXPO_TOKEN=

# Ключи Supabase — те же, что в .env на ноутбуке.
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=

# Ветка, за которой следим.
KM_BRANCH=claude/stoic-allen-6zgmve

# Куда сообщать о сборках. Пусто — только в журнал.
# Телеграм: https://api.telegram.org/bot<ТОКЕН>/sendMessage?chat_id=<ВАШ_ID>&text=
KM_NOTIFY_URL=
ENV
  chmod 600 /etc/km/env
  bold "  создан /etc/km/env — заполните его"
else
  bold "  /etc/km/env уже есть, не трогаю"
fi

step "Службы"
install -m 755 "$KM_HOME/repo/server/watch.sh" /usr/local/bin/km-watch 2>/dev/null \
  || install -m 755 "$(dirname "$0")/watch.sh" /usr/local/bin/km-watch

cp "$(dirname "$0")/km-watch.service" /etc/systemd/system/
cp "$(dirname "$0")/km-watch.timer" /etc/systemd/system/
cp "$(dirname "$0")/km-apk.service" /etc/systemd/system/

systemctl daemon-reload
systemctl enable --now km-apk.service >/dev/null
systemctl enable --now km-watch.timer >/dev/null
bold "  сторож просыпается каждые две минуты"

cat <<NOTE

Готово. Осталось одно — вписать ключи:

  nano /etc/km/env

Нужны EXPO_TOKEN и два ключа Supabase (возьмите из .env на ноутбуке).
После этого:

  systemctl start km-watch.service     # проверить прямо сейчас
  journalctl -u km-watch -f            # смотреть, что происходит

Готовые apk лежат в $KM_HOME/apk и раздаются по адресу
http://<адрес-сервера>:8088 — с телефона открывается и ставится.

NOTE
