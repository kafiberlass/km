/**
 * Аккаунт: почта, по которой человека узнают на новом телефоне.
 *
 * До этого экрана аккаунт заводился молча при первом запуске и жил внутри
 * установки приложения. Разбила телефон, купила новый, поставила заново —
 * завёлся другой аккаунт: новый код для друзей, а копия на сервере
 * осталась в папке прежнего и стала недостижимой. То есть автоматическая
 * копия спасала от разбитого экрана, но не от смены телефона — ровно
 * от того случая, ради которого её и заводят.
 *
 * Подтверждение идёт ссылкой из письма, а не шестизначным кодом, и это
 * не выбор, а обстоятельство: код живёт в шаблоне письма, а менять
 * шаблоны на бесплатном тарифе Supabase не разрешает вовсе — отвечает
 * «email template modification is not available for free tier projects».
 * Заводское письмо со ссылкой при этом работает прекрасно, если ссылка
 * ведёт в приложение, а не в браузер.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

import { fonts, line, palette, radii, spacing, text } from '@/core/theme/tokens';
import { authMessage, isValidEmail, maskEmail, normalizeEmail } from '@/features/account/email';
import { useAccountEvent } from '@/features/account/session';
import { createFriendsProvider, isServerConfigured } from '@/features/friends';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { ActionButton } from '@/ui/widgets';

const ORIGIN = { lat: 0, lng: 0 };

type Note = { text: string; ok: boolean } | null;

/**
 * Одна форма на два дела: привязать почту и войти.
 *
 * Шаги совпадают полностью — адрес, письмо, ссылка, — и разводить их
 * значит завести два места, где по-разному обрабатывается опечатка.
 */
function EmailForm({
  action,
  onSend,
}: {
  action: string;
  onSend: (email: string) => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);

  const send = useCallback(async () => {
    const address = normalizeEmail(email);
    if (!isValidEmail(address)) {
      setNote({ text: 'Проверьте адрес — похоже, в нём опечатка', ok: false });
      return;
    }

    setBusy(true);
    setNote(null);
    try {
      await onSend(address);
      setSent(true);
      setNote({ text: `Письмо отправлено на ${address}`, ok: true });
    } catch (error) {
      setNote({ text: authMessage(error), ok: false });
    } finally {
      setBusy(false);
    }
  }, [email, onSend]);

  return (
    <>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="почта@пример.ру"
        placeholderTextColor={palette.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        editable={!busy}
        style={styles.input}
      />

      <ActionButton
        label={sent ? 'ОТПРАВИТЬ ПИСЬМО ЗАНОВО' : action}
        tone={sent ? 'ghost' : 'primary'}
        onPress={() => void send()}
        disabled={busy}
      />

      {busy && <ActivityIndicator color={palette.ember} />}

      {sent && (
        <Text style={styles.body}>
          Откройте письмо и нажмите ссылку — приложение откроется само, вводить ничего
          не нужно. Письмо идёт до минуты и любит попадать в «Промоакции» и спам.
        </Text>
      )}

      {note != null && (
        <View style={styles.note}>
          <Feather
            name={note.ok ? 'check-circle' : 'alert-triangle'}
            size={16}
            color={note.ok ? palette.teal : palette.rust}
          />
          <Text style={note.ok ? styles.ok : styles.error}>{note.text}</Text>
        </View>
      )}
    </>
  );
}

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const serverReady = isServerConfigured();

  // null — ещё спрашиваем, '' — аккаунт анонимный, адрес — привязан.
  const [email, setEmail] = useState<string | null>(null);

  // Ссылку из письма ловит корневой слушатель: экран узнаёт о входе
  // отсюда, а не из собственной кнопки, — человек мог открыть письмо
  // и через час, и с закрытым приложением.
  const event = useAccountEvent();

  useEffect(() => {
    if (!serverReady) {
      setEmail('');
      return;
    }

    let cancelled = false;
    void (async () => {
      const provider = createFriendsProvider(ORIGIN);
      const value = await provider.accountEmail?.().catch(() => null);
      if (!cancelled) setEmail(value ?? '');
    })();

    return () => {
      cancelled = true;
    };
    // Успешный вход меняет всё: аккаунт спрашиваем заново.
  }, [serverReady, event]);

  const linked = email != null && email.length > 0;

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Аккаунт"
        subtitle="Чтобы история не осталась в старом телефоне"
        topInset={insets.top}
        onClose={() => router.back()}
      />

      <View style={styles.content}>
        {event != null && (
          <View style={[styles.card, event.ok ? styles.cardOk : styles.cardBad]}>
            <View style={styles.note}>
              <Feather
                name={event.ok ? 'check-circle' : 'alert-triangle'}
                size={16}
                color={event.ok ? palette.teal : palette.rust}
              />
              <Text style={event.ok ? styles.ok : styles.error}>{event.message}</Text>
            </View>
            {event.ok && (
              <ActionButton label="ЗАБРАТЬ ИСТОРИЮ" onPress={() => router.push('/backup')} />
            )}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>СЕЙЧАС</Text>
          {email == null ? (
            <ActivityIndicator color={palette.ember} />
          ) : linked ? (
            <Text style={styles.body}>
              Аккаунт привязан к {maskEmail(email)}. На новом телефоне введите этот адрес —
              вернутся друзья, код и копия.
            </Text>
          ) : (
            <Text style={styles.body}>
              Аккаунт живёт только в этом телефоне. Потеряете телефон — потеряете и друзей,
              и копию на сервере: она лежит в папке этого аккаунта, и новый до неё
              не дотянется.
            </Text>
          )}
        </View>

        {serverReady && email != null && !linked && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>ПРИВЯЗАТЬ ПОЧТУ</Text>
            <Text style={styles.body}>
              Придёт письмо со ссылкой. Пароль придумывать не нужно. Друзья, код и история
              остаются на месте — аккаунт не меняется, а получает имя.
            </Text>

            <EmailForm
              action="ОТПРАВИТЬ ПИСЬМО"
              onSend={async (address) => {
                await createFriendsProvider(ORIGIN).linkEmail?.(address);
              }}
            />
          </View>
        )}

        {serverReady && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>ВОЙТИ В СВОЙ АККАУНТ</Text>
            <Text style={styles.body}>
              Это для нового телефона: введите почту, к которой привязан старый аккаунт.
              История при этом не перенесётся сама — после входа заберите её на экране
              копии.
            </Text>

            <EmailForm
              action="ОТПРАВИТЬ ПИСЬМО"
              onSend={async (address) => {
                await createFriendsProvider(ORIGIN).signInByEmail?.(address);
              }}
            />
          </View>
        )}

        {!serverReady && (
          <View style={styles.card}>
            <Text style={styles.body}>
              Приложение собрано без ключей от сервера: аккаунтов в нём нет, и привязывать
              нечего.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.dune },
  content: { padding: spacing.lg, gap: spacing.md },
  card: {
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: line,
    borderColor: palette.edgeSoft,
    backgroundColor: palette.parchment,
    gap: spacing.sm,
  },
  cardOk: { borderColor: palette.teal },
  cardBad: { borderColor: palette.rust },
  cardTitle: {
    color: palette.textMuted,
    fontFamily: fonts.display,
    fontWeight: '900',
    letterSpacing: 1,
    fontSize: text.meta,
  },
  body: { color: palette.textDark, fontFamily: fonts.body, fontSize: text.body },
  input: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: line,
    borderColor: palette.edgeSoft,
    backgroundColor: palette.parchmentBright,
    color: palette.textDark,
    fontFamily: fonts.body,
    fontSize: text.body,
  },
  note: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ok: { color: palette.teal, fontFamily: fonts.display, fontWeight: '700', flex: 1 },
  error: { color: palette.rust, fontFamily: fonts.display, fontWeight: '700', flex: 1 },
});
