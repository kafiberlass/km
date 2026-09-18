/**
 * Дев-панель: проиграть фейковую прогулку, не выходя из дома.
 *
 * Это инструмент №1 в проекте. Он проверяет всю JS-цепочку —
 * фильтр, H3, туман, XP, ачивки, стрик — за секунды вместо получаса
 * на улице. Нативную часть (foreground service, поведение после
 * сворачивания) он НЕ проверяет: для этого нужен Lockito, см. README.
 */

import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { WALK_CHISTYE_PRUDY_GPX } from '../assets/fixtures/walkChistyePrudy';
import { resetDatabase } from '@/core/db/client';
import { countCells } from '@/core/db/repo';
import { DEFAULT_FILTER, filterTrack } from '@/core/geo/filter';
import { parseGpx } from '@/core/geo/gpx';
import { palette, radii, spacing } from '@/core/theme/tokens';
import { fogSetting, useFogEnabled } from '@/features/fog/fogSetting';
import { MockTrackingProvider } from '@/features/tracking/mock';
import { ActionButton, Stat } from '@/ui/widgets';
import { useWalkStore } from '@/store/useWalkStore';

const SPEEDS = [1, 20, 100] as const;

export default function DevScreen() {
  const insets = useSafeAreaInsets();
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const fogEnabled = useFogEnabled();

  const ingest = useWalkStore((s) => s.ingest);
  const start = useWalkStore((s) => s.start);
  const stop = useWalkStore((s) => s.stop);
  const hydrate = useWalkStore((s) => s.hydrate);
  const acceptedPoints = useWalkStore((s) => s.acceptedPoints);
  const rejectedPoints = useWalkStore((s) => s.rejectedPoints);
  const distanceM = useWalkStore((s) => s.distanceM);

  const append = useCallback((line: string) => {
    setLog((prev) => [`${new Date().toLocaleTimeString()}  ${line}`, ...prev].slice(0, 30));
  }, []);

  /** Прогон «в уме»: показывает, что отсеет фильтр, ничего не записывая. */
  const dryRun = useCallback(() => {
    const points = parseGpx(WALK_CHISTYE_PRUDY_GPX);
    const result = filterTrack(points, DEFAULT_FILTER);
    append(
      `dry-run: ${points.length} точек -> ${result.segments.length} сегм., ` +
        `${(result.distanceM / 1000).toFixed(2)} км, ` +
        `отсеяно: точность ${result.rejected.accuracy}, ` +
        `дрожание ${result.rejected.jitter}, скорость ${result.rejected.speed}`,
    );
  }, [append]);

  const playFixture = useCallback(
    async (speed: number) => {
      if (busy) return;
      setBusy(true);
      append(`старт фикстуры ×${speed}`);

      const provider = new MockTrackingProvider();
      const count = provider.loadGpx(WALK_CHISTYE_PRUDY_GPX);
      provider.configure({ speedMultiplier: speed, jitterM: 0 });
      append(`загружено точек: ${count}`);

      // Прогулку открывает обычный store — весь пайплайн тот же, что в проде.
      await start({ source: 'mock' });
      const unsubscribe = provider.subscribe((point) => ingest(point));
      const done = new Promise<void>((resolve) => {
        provider.onStatusChange((status) => {
          if (status === 'idle') resolve();
        });
      });

      await provider.start();
      await done;

      unsubscribe();
      await stop();
      append(`готово, ячеек всего: ${countCells()}`);
      setBusy(false);
    },
    [append, busy, ingest, start, stop],
  );

  /** Мгновенный прогон — для проверки правил, без ожидания анимации. */
  const playInstant = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    const provider = new MockTrackingProvider();
    provider.loadGpx(WALK_CHISTYE_PRUDY_GPX);

    await start({ source: 'mock' });
    const started = Date.now();
    const unsubscribe = provider.subscribe((point) => ingest(point));
    const emitted = provider.flush();
    unsubscribe();
    await stop();

    append(`мгновенно: ${emitted.length} точек за ${Date.now() - started} мс`);
    setBusy(false);
  }, [append, busy, ingest, start, stop]);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
    >
      <Text style={styles.heading}>DEV</Text>
      <Text style={styles.subheading}>Чистые пруды, вечер · 212 точек · ~2.6 км</Text>

      <View style={styles.row}>
        <Stat label="ПРИНЯТО" value={String(acceptedPoints)} />
        <Stat label="ОТСЕЯНО" value={String(rejectedPoints)} />
        <Stat label="КМ" value={(distanceM / 1000).toFixed(2)} />
      </View>

      {/* Под туманом не видно ни карты, ни того, правильно ли легла тропа.
          Переключатель действует сразу на обоих экранах с картой
          и переживает перезапуск. */}
      <ActionButton
        label={fogEnabled ? 'ТУМАН: ВКЛЮЧЁН' : 'ТУМАН: ВЫКЛЮЧЕН'}
        tone={fogEnabled ? 'primary' : 'ghost'}
        onPress={() => {
          const next = fogSetting.toggle();
          append(next ? 'туман включён' : 'туман выключен');
        }}
      />

      <ActionButton label="DRY-RUN ФИЛЬТРА" tone="ghost" onPress={dryRun} />
      <ActionButton label="ПРОИГРАТЬ МГНОВЕННО" onPress={() => void playInstant()} disabled={busy} />

      {SPEEDS.map((speed) => (
        <ActionButton
          key={speed}
          label={`ПРОИГРАТЬ ×${speed}`}
          tone="ghost"
          onPress={() => void playFixture(speed)}
          disabled={busy}
        />
      ))}

      <ActionButton
        label="СБРОСИТЬ БАЗУ"
        tone="ghost"
        onPress={() => {
          resetDatabase();
          hydrate();
          append('база очищена');
        }}
      />
      <ActionButton label="ЗАКРЫТЬ" tone="ghost" onPress={() => router.back()} />

      <View style={styles.logBox}>
        {log.length === 0 && <Text style={styles.logEmpty}>Лог пуст</Text>}
        {log.map((line, index) => (
          <Text key={`${line}-${index}`} style={styles.logLine}>
            {line}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.fog },
  content: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  heading: { color: palette.textOnDark, fontSize: 24, fontWeight: '900', letterSpacing: 2 },
  subheading: { color: palette.parchment, marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  logBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 3,
    borderColor: palette.ink,
    backgroundColor: palette.ink,
    gap: 4,
  },
  logEmpty: { color: palette.textMuted },
  logLine: { color: palette.parchment, fontSize: 11, fontFamily: 'monospace' },
});
