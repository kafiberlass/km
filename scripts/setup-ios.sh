#!/usr/bin/env bash
#
# Установка на iPhone под бесплатным Apple ID.
#
#   npm run setup:ios
#
# Скрипт делает всё, что можно сделать за пользователя: проверяет окружение,
# ставит зависимости, генерирует нативный проект и запускает сборку на
# подключённом телефоне. Ручными остаются три вещи, которые принципиально
# нельзя автоматизировать: установка Xcode из App Store, вход в Apple ID
# и подтверждения на самом телефоне. Про каждую скрипт скажет отдельно.
#
# Падает на первой же непонятной ситуации с человеческим текстом, а не
# со стеком: это инструмент для того, кто собирает приложение впервые.

set -euo pipefail

cd "$(dirname "$0")/.."

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
step() { printf '\n\033[1m→ %s\033[0m\n' "$1"; }
fail() { printf '\n\033[31m✗ %s\033[0m\n\n' "$1" >&2; exit 1; }

step "Проверяю окружение"

[ "$(uname)" = "Darwin" ] || fail "Скрипт работает только на macOS: собрать
приложение для iPhone без Mac нельзя — таково требование Apple."

if ! command -v node >/dev/null 2>&1; then
  fail "Не найден Node.js. Скачайте LTS-версию с https://nodejs.org,
установите и запустите скрипт заново."
fi

# xcode-select по умолчанию указывает на Command Line Tools. Их достаточно
# для компиляции, но не для установки на устройство — нужен полный Xcode.
XCODE_PATH="$(xcode-select -p 2>/dev/null || true)"
case "$XCODE_PATH" in
  *Xcode.app*) ;;
  *)
    fail "Нужен полный Xcode, а не только Command Line Tools.
1. Поставьте Xcode из App Store (бесплатно, ~10 ГБ, ставится долго).
2. Запустите его один раз и согласитесь с лицензией.
3. Выполните: sudo xcode-select -s /Applications/Xcode.app
4. Запустите скрипт заново."
    ;;
esac

if ! xcodebuild -version >/dev/null 2>&1; then
  fail "Xcode установлен, но не принята лицензия.
Выполните: sudo xcodebuild -license accept — и запустите скрипт заново."
fi

# Homebrew на Apple Silicon живёт в /opt/homebrew и попадает в PATH только
# через ~/.zprofile. Если его туда не дописали — brew есть, но не находится;
# классическая ловушка после свежей установки, поэтому ищем руками.
if ! command -v brew >/dev/null 2>&1; then
  for candidate in /opt/homebrew/bin/brew /usr/local/bin/brew; do
    [ -x "$candidate" ] && eval "$("$candidate" shellenv)" && break
  done
fi

if ! command -v pod >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    step "Ставлю CocoaPods (его не было, Homebrew есть)"
    brew install cocoapods
  else
    fail "Не найдены ни CocoaPods, ни Homebrew, через который его ставят.
1. Поставьте Homebrew — команда с https://brew.sh (спросит пароль от Mac,
   он вводится вслепую, символы не отображаются — это нормально).
2. На Mac с процессором M1/M2/M3 после установки выполните ещё две строки,
   иначе brew не найдётся:
     echo 'eval \"\$(/opt/homebrew/bin/brew shellenv)\"' >> ~/.zprofile
     eval \"\$(/opt/homebrew/bin/brew shellenv)\"
3. Запустите скрипт заново — CocoaPods он поставит сам."
  fi
fi

bold "  Xcode $(xcodebuild -version | head -1 | awk '{print $2}'), Node $(node -v), CocoaPods $(pod --version)"

# Сертификат подписи. Expo сообщает о его отсутствии только после установки
# зависимостей и prebuild — двадцать минут ради ошибки, которую видно сразу.
#
# Случая два, и различать их обязательно: сертификата нет вовсе (нужен вход
# в Apple ID) или он есть, но недействителен. Второе — почти всегда нехватка
# промежуточных сертификатов Apple в связке ключей: без них цепочка не
# сходится, security показывает «1 identities found / 0 valid», а Expo
# говорит ровно то же, что и при отсутствии сертификата, и совет «заведите
# сертификат» уводит в сторону.
if ! security find-identity -v -p codesigning 2>/dev/null | grep -q "Apple Development"; then
  if security find-identity -p codesigning 2>/dev/null | grep -q "Apple Development"; then
    step "Сертификат есть, но недействителен — доставляю промежуточные сертификаты Apple"
    tmp="$(mktemp -d)"
    (
      cd "$tmp"
      # Поколения WWDR выпускаются по мере истечения предыдущих, и какое
      # нужно — зависит от даты выпуска сертификата. Качаем все известные,
      # несуществующие просто не скачаются.
      for name in AppleWWDRCAG2 AppleWWDRCAG3 AppleWWDRCAG4 AppleWWDRCAG5 AppleWWDRCAG6 \
                  AppleRootCA-G2 AppleRootCA-G3; do
        curl -fsLO "https://www.apple.com/certificateauthority/$name.cer" || true
      done
      curl -fsLO "https://www.apple.com/appleca/AppleIncRootCertificate.cer" || true
      for file in *.cer; do
        [ -f "$file" ] && security import "$file" -k ~/Library/Keychains/login.keychain-db >/dev/null 2>&1 || true
      done
    )
    rm -rf "$tmp"

    if security find-identity -v -p codesigning 2>/dev/null | grep -q "Apple Development"; then
      bold "  Готово, сертификат стал действительным."
    else
      fail "Сертификат в связке ключей есть, но остаётся недействительным.
Промежуточные сертификаты Apple я доставил — не помогло. Чаще всего это
значит, что рядом лежит просроченный WWDR предыдущего поколения и он
перебивает новый.

Посмотреть, чем подписан ваш сертификат и что есть в связке:
  security find-certificate -a -c \"Worldwide Developer Relations\" | grep labl

Просроченные строки удаляются в приложении «Связка ключей» (Keychain
Access): вкладка «Мои сертификаты», правый клик по просроченному WWDR →
«Удалить»."
    fi
  else
    fail "Xcode не знает ваш Apple ID, поэтому подписывать сборку нечем.
Это единственный шаг, который нельзя сделать за вас — вход в аккаунт.

1. Откройте Xcode → меню Xcode → Settings… (Cmd+,) → вкладка Accounts.
2. Кнопка «+» слева внизу → Apple ID → войдите (тот же, что на телефоне).
3. Выделите появившийся аккаунт → «Manage Certificates…» справа.
4. «+» слева внизу → «Apple Development» → Done.

Платная подписка для этого не нужна: личный аккаунт выпускает сертификат
бесплатно. Дальше запустите скрипт заново."
  fi
fi

step "Ставлю зависимости (пара минут)"
npm install

step "Генерирую нативный проект ios/"
# Папки ios/ нет в репозитории намеренно: она полностью выводится из app.json
# и package.json, а держать её в гите — значит ловить конфликты на каждом
# изменении конфига.
npx expo prebuild --clean -p ios

step "Проверяю подключённый iPhone"
if ! xcrun xctrace list devices 2>/dev/null | grep -qiE '\(iPhone|iPhone.*\('; then
  bold "  Телефон не вижу. Подключите его кабелем, разблокируйте и нажмите
  на нём «Доверять этому компьютеру». Продолжаю — Expo спросит устройство сам."
fi

cat <<'NOTE'

────────────────────────────────────────────────────────────────────────
Дальше Expo спросит Apple ID — это обычный аккаунт, тот же, что на
телефоне. Платная подписка ($99) не нужна: личный аккаунт подписывает
сборку бесплатно.

Два раза телефон попросит разрешения — это нормально, не поломка:

1. «Режим разработчика» — Настройки → Конфиденциальность и безопасность →
   Режим разработчика → включить. Телефон перезагрузится. Пункт появляется
   только после первой попытки установки, раньше его в настройках нет.

2. После установки приложение не откроется, пока не подтвердите:
   Настройки → Основные → VPN и управление устройством → ваш Apple ID →
   «Доверять».

Первая сборка идёт 10–20 минут. Дальше — секунды.
────────────────────────────────────────────────────────────────────────

NOTE

step "Собираю и ставлю на телефон"
npx expo run:ios --device

cat <<'NOTE'

Готово. Что дальше:

  npx expo start --dev-client   — обычный режим разработки: правки в коде
                                  подхватываются без пересборки.

Через 7 дней приложение перестанет открываться — это лимит бесплатной
подписи Apple, а не баг. Лечится повторным запуском: npm run setup:ios

NOTE
