#!/usr/bin/env bash
#
# Передать ключи Supabase в облако Expo.
#
# Подключается и сборкой, и отправкой обновления — намеренно обоими.
# Ключи лежат в .env, а .env не уезжает в репозиторий: он в .gitignore,
# и это правильно. Значит, единственный способ дать их облаку — положить
# в переменные окружения проекта на стороне Expo.
#
# Без них приложение собирается с демонстрационными друзьями и молча
# показывает выдуманных людей вместо настоящих. Ровно это и случилось:
# ключи один раз не доехали, и поймать это удалось только по жалобе
# «а почему у мамы какие-то чужие друзья».
#
# Вызов: sync_env_to_expo <окружение>

sync_env_to_expo() {
  local environment="${1:-preview}"

  if [ ! -f .env ]; then
    warn "  Файла .env нет: приложение соберётся с демо-друзьями."
    return 0
  fi

  local pushed=0
  local key value
  while IFS='=' read -r key value; do
    case "$key" in
      EXPO_PUBLIC_SUPABASE_URL|EXPO_PUBLIC_SUPABASE_ANON_KEY)
        [ -z "${value:-}" ] && continue
        # Тихо: значения не печатаем, хоть ключ и публичный по замыслу.
        if eas env:create --name "$key" --value "$value" \
          --environment "$environment" --visibility plaintext --force >/dev/null 2>&1; then
          bold "  $key передан"
          pushed=$((pushed + 1))
        else
          warn "  Не удалось передать $key — проверьте вручную: eas env:list --environment $environment"
        fi
        ;;
    esac
  done < <(grep -E '^EXPO_PUBLIC_SUPABASE' .env || true)

  if [ "$pushed" -lt 2 ]; then
    warn "  В облаке меньше двух ключей — друзья могут оказаться демонстрационными."
  fi
}
