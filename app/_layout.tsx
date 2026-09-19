import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';

import { migrate } from '@/core/db/client';
import { seedDemoPlaces } from '@/features/places/seed';
import { fonts, palette } from '@/core/theme/tokens';
import { useWalkStore } from '@/store/useWalkStore';

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hydrate = useWalkStore((s) => s.hydrate);

  // Шрифты макета: Oswald для заголовков, VT323 для цифр. Оба под OFL,
  // встраивание разрешено. Если файл не прочитался, `fontsError` не должен
  // держать приложение на заставке — текст просто нарисуется системным
  // шрифтом, и это гораздо лучше, чем чёрный экран.
  const [fontsLoaded, fontsError] = useFonts({
    'Oswald-Bold': require('../assets/fonts/Oswald-Bold.ttf'),
    'Oswald-Regular': require('../assets/fonts/Oswald-Regular.ttf'),
    'VT323-Regular': require('../assets/fonts/VT323-Regular.ttf'),
  });

  useEffect(() => {
    try {
      // Схема поднимается синхронно до первого экрана: половина приложения
      // читает БД прямо в рендере, асинхронная инициализация дала бы гонки.
      migrate();
      seedDemoPlaces();
      hydrate();
      setReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [hydrate]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Не удалось открыть базу</Text>
        <Text style={styles.errorBody}>{error}</Text>
      </View>
    );
  }

  if (!ready || (!fontsLoaded && !fontsError)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.ember} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: styles.root }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="dev" options={{ presentation: 'modal' }} />
          {/* Ачивки — не отдельная вкладка: разглядывать их каждый день
              незачем, а место в панели стоит дорого. Открываются из профиля. */}
          <Stack.Screen name="achievements" options={{ presentation: 'modal' }} />
          <Stack.Screen name="profile-edit" options={{ presentation: 'modal' }} />
          <Stack.Screen name="history" options={{ presentation: 'modal' }} />
          <Stack.Screen name="backup" options={{ presentation: 'modal' }} />
          {/* Карта во весь экран: именно fullScreenModal, а не modal —
              иначе сверху осталась бы полоска предыдущего экрана, ради
              избавления от которой окно и заводилось. */}
          <Stack.Screen name="map-full" options={{ presentation: 'fullScreenModal' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.fog },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: palette.fog,
  },
  errorTitle: { color: palette.textOnDark, fontFamily: fonts.display, fontWeight: '900', fontSize: 18, marginBottom: 8 },
  errorBody: { color: palette.parchment, textAlign: 'center' },
});
