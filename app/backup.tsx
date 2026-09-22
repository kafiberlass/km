/**
 * Резервная копия.
 *
 * Вся карта живёт в телефоне: потерял телефон — потерял год ходьбы.
 * Копия — обычный файл, который система предлагает положить куда угодно:
 * в «Файлы», в облако, отправить себе же в мессенджер.
 *
 * Ни экспорт, ни импорт не требуют интернета и чужих серверов — человек
 * сам решает, где лежит его история.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Directory, File, Paths } from 'expo-file-system';

import { collectBackup, restoreBackup } from '@/core/db/backup';
import { backupFileName, parseBackup, summarize } from '@/core/backup/format';
import { fonts, line, palette, radii, spacing, text } from '@/core/theme/tokens';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { ActionButton, Stat } from '@/ui/widgets';
import { createFriendsProvider, isServerConfigured } from '@/features/friends';
import type { RemoteBackup } from '@/features/friends/types';
import { useWalkStore } from '@/store/useWalkStore';

const FOLDER = 'backups';

/** «2,4 МБ» — чтобы было видно, что копия не пустая. */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

function formatDate(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeStyle: 'short' }).format(
      new Date(timestamp),
    );
  } catch {
    return new Date(timestamp).toISOString();
  }
}

export default function BackupScreen() {
  const insets = useSafeAreaInsets();
  const hydrate = useWalkStore((s) => s.hydrate);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  // Что вообще есть в телефоне — чтобы человек видел, что именно сохраняет.
  const [snapshot] = useState(() => summarize(collectBackup()));

  const serverReady = isServerConfigured();
  const [remote, setRemote] = useState<RemoteBackup | null>(null);

  // Что лежит на сервере, спрашиваем один раз при открытии экрана.
  useEffect(() => {
    if (!serverReady) return;

    let cancelled = false;
    void (async () => {
      const provider = createFriendsProvider({ lat: 0, lng: 0 });
      const info = await provider.backupInfo?.().catch(() => null);
      if (!cancelled) setRemote(info ?? null);
    })();

    return () => {
      cancelled = true;
    };
  }, [serverReady]);

  const saveRemote = useCallback(async () => {
    setBusy(true);
    setMessage(null);

    try {
      const provider = createFriendsProvider({ lat: 0, lng: 0 });
      if (!provider.uploadBackup) throw new Error('Сервер не настроен');

      await provider.uploadBackup(JSON.stringify(collectBackup()));
      setRemote((await provider.backupInfo?.()) ?? null);
      setMessage({ text: 'Копия сохранена на сервере', ok: true });
    } catch (error) {
      console.warn('[backup] не удалось отправить копию', error);
      setMessage({ text: 'Не получилось сохранить копию на сервер', ok: false });
    } finally {
      setBusy(false);
    }
  }, []);

  const restoreRemote = useCallback(async () => {
    setBusy(true);
    setMessage(null);

    try {
      const provider = createFriendsProvider({ lat: 0, lng: 0 });
      const raw = await provider.downloadBackup?.();
      if (!raw) {
        setMessage({ text: 'На сервере копии нет', ok: false });
        setBusy(false);
        return;
      }

      const parsed = parseBackup(raw);
      if (parsed.status !== 'ok') {
        setMessage({ text: 'Копия на сервере не читается', ok: false });
        setBusy(false);
        return;
      }

      const info = summarize(parsed.data);

      // Замена необратима — переспрашиваем, как и для копии из файла.
      Alert.alert(
        'Заменить всё копией с сервера?',
        `Копия от ${formatDate(info.createdAt)}: ${info.walks} прогулок, ${info.cells} клеток, уровень ${info.level}.\n\nВсё, что сейчас в телефоне, будет заменено.`,
        [
          { text: 'Отмена', style: 'cancel', onPress: () => setBusy(false) },
          {
            text: 'Заменить',
            style: 'destructive',
            onPress: () => {
              try {
                restoreBackup(parsed.data);
                hydrate();
                setMessage({ text: 'Готово: история восстановлена', ok: true });
              } catch (error) {
                console.warn('[backup] не удалось восстановить', error);
                setMessage({ text: 'Не получилось восстановить копию', ok: false });
              } finally {
                setBusy(false);
              }
            },
          },
        ],
      );
    } catch (error) {
      console.warn('[backup] не удалось забрать копию', error);
      setMessage({ text: 'Не получилось забрать копию с сервера', ok: false });
      setBusy(false);
    }
  }, [hydrate]);

  const save = useCallback(async () => {
    setBusy(true);
    setMessage(null);

    try {
      const data = collectBackup();
      const directory = new Directory(Paths.document, FOLDER);
      if (!directory.exists) directory.create({ intermediates: true });

      const file = new File(directory, backupFileName(data.createdAt));
      if (file.exists) file.delete();
      file.create();
      file.write(JSON.stringify(data));

      // Системное окно «Поделиться»: человек сам выбирает, куда положить.
      await Share.share({ url: file.uri, title: file.name });
      setMessage({ text: 'Копия сохранена', ok: true });
    } catch (error) {
      console.warn('[backup] не удалось сохранить', error);
      setMessage({ text: 'Не получилось сохранить копию', ok: false });
    } finally {
      setBusy(false);
    }
  }, []);

  const restore = useCallback(async () => {
    setBusy(true);
    setMessage(null);

    try {
      // На iOS система отдаёт временную копию выбранного файла — оригинал
      // в «Файлах» при этом не трогается.
      const picked = await File.pickFileAsync({ mimeTypes: ['application/json'] });
      if (picked.canceled || !picked.result) {
        setBusy(false);
        return;
      }

      const parsed = parseBackup(picked.result.textSync());

      if (parsed.status === 'not-json' || parsed.status === 'not-backup') {
        setMessage({ text: 'Это не копия КМ — выберите файл вида km-2026-03-14.json', ok: false });
        setBusy(false);
        return;
      }
      if (parsed.status === 'too-new') {
        setMessage({
          text: 'Копия сделана более новой версией приложения. Сначала обновите его',
          ok: false,
        });
        setBusy(false);
        return;
      }

      const info = summarize(parsed.data);

      // Подтверждение обязательно: восстановление заменяет всё, и отменить
      // его нечем. Человек должен увидеть, что именно он возвращает.
      Alert.alert(
        'Заменить всё на эту копию?',
        `Копия от ${formatDate(info.createdAt)}: ${info.walks} прогулок, ${info.cells} клеток, уровень ${info.level}.\n\nВсё, что сейчас в телефоне, будет заменено.`,
        [
          { text: 'Отмена', style: 'cancel', onPress: () => setBusy(false) },
          {
            text: 'Заменить',
            style: 'destructive',
            onPress: () => {
              try {
                restoreBackup(parsed.data);
                hydrate();
                setMessage({ text: 'Готово: история восстановлена', ok: true });
              } catch (error) {
                console.warn('[backup] не удалось восстановить', error);
                setMessage({ text: 'Не получилось восстановить копию', ok: false });
              } finally {
                setBusy(false);
              }
            },
          },
        ],
      );
    } catch (error) {
      console.warn('[backup] не удалось прочитать файл', error);
      setMessage({ text: 'Не получилось прочитать файл', ok: false });
      setBusy(false);
    }
  }, [hydrate]);

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Копия"
        subtitle="Чтобы не потерять карту вместе с телефоном"
        topInset={insets.top}
        onClose={() => router.back()}
      />

      <View style={styles.content}>
        <View style={styles.row}>
          <Stat label="ПРОГУЛОК" value={String(snapshot.walks)} />
          <Stat label="КЛЕТОК" value={String(snapshot.cells)} />
          <Stat label="ТОЧЕК" value={String(snapshot.points)} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>СОХРАНИТЬ</Text>
          <Text style={styles.body}>
            Приложение соберёт файл и откроет окно «Поделиться»: положите его в «Файлы»,
            в облако или отправьте себе. Интернет для этого не нужен.
          </Text>
          <ActionButton label="СОХРАНИТЬ КОПИЮ" onPress={() => void save()} disabled={busy} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>ВОССТАНОВИТЬ</Text>
          <Text style={styles.body}>
            Выберите файл копии. Всё, что сейчас в телефоне, будет заменено — прогулки,
            туман, уровень. Приложение переспросит перед заменой.
          </Text>
          <ActionButton
            label="ВОССТАНОВИТЬ ИЗ ФАЙЛА"
            tone="ghost"
            onPress={() => void restore()}
            disabled={busy}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>КОПИЯ НА СЕРВЕРЕ</Text>
          <Text style={styles.body}>
            {remote == null
              ? 'На сервере копии пока нет.'
              : `Последняя копия: ${formatDate(remote.updatedAt)} · ${formatSize(remote.sizeBytes)}`}
          </Text>
          <Text style={styles.body}>
            Копия лежит в закрытом хранилище: читать её можете только вы, даже друзья
            не видят. Но это значит, что история прогулок уходит с телефона, — в файле
            она никуда не уходит, и в этом разница между двумя способами.
          </Text>

          <ActionButton
            label="СОХРАНИТЬ НА СЕРВЕР"
            onPress={() => void saveRemote()}
            disabled={busy || !serverReady}
          />
          <ActionButton
            label="ВОССТАНОВИТЬ С СЕРВЕРА"
            tone="ghost"
            onPress={() => void restoreRemote()}
            disabled={busy || !serverReady || remote == null}
          />

          {!serverReady && (
            <Text style={styles.body}>
              Сервер не настроен: приложение собрано без ключей, и класть копию некуда.
            </Text>
          )}
        </View>

        {busy && <ActivityIndicator color={palette.ember} />}

        {message != null && (
          <View style={styles.message}>
            <Feather
              name={message.ok ? 'check-circle' : 'alert-triangle'}
              size={16}
              color={message.ok ? palette.teal : palette.rust}
            />
            <Text style={message.ok ? styles.ok : styles.error}>{message.text}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.dune },
  content: { padding: spacing.lg, gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  card: {
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: line,
    borderColor: palette.edgeSoft,
    backgroundColor: palette.parchment,
    gap: spacing.sm,
  },
  cardTitle: {
    color: palette.textMuted,
    fontFamily: fonts.display,
    fontWeight: '900',
    letterSpacing: 1,
    fontSize: text.meta,
  },
  body: { color: palette.textDark, fontFamily: fonts.body, fontSize: text.body },
  message: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ok: { color: palette.teal, fontFamily: fonts.display, fontWeight: '700', flex: 1 },
  error: { color: palette.rust, fontFamily: fonts.display, fontWeight: '700', flex: 1 },
});
