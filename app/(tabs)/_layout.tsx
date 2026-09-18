import React from 'react';
import { StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts, palette, radii, spacing } from '@/core/theme/tokens';

/**
 * Высота панели без учёта жеста «домой».
 *
 * С запасом: иконка 20, подпись 10 и рамка кнопки в 3 пункта суммарно
 * требуют около 50, остальное — воздух. Занижать нельзя, обрезается подпись.
 */
const BAR_HEIGHT = 72;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  // Половину безопасной зоны панель забирает себе в высоту, но не в отступ:
  // кнопки заходят в неё и доходят до нижнего края панели, а подписи
  // остаются выше системной чёрточки жеста «домой».
  const bottomInset = Math.round(insets.bottom / 2);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Явная высота отменяет ту, что навигация считает с учётом
        // безопасной зоны, поэтому полосу под жест «домой» добавляем сами —
        // иначе подписи вкладок уезжают под нижний край экрана и обрезаются.
        tabBarStyle: [
          styles.bar,
          { height: BAR_HEIGHT + bottomInset, paddingBottom: spacing.sm },
        ],
        tabBarItemStyle: styles.item,
        tabBarActiveTintColor: palette.textOnDark,
        tabBarInactiveTintColor: palette.textDark,
        tabBarActiveBackgroundColor: palette.ember,
        tabBarInactiveBackgroundColor: palette.parchmentBright,
        tabBarLabelStyle: styles.label,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'КАРТА',
          tabBarIcon: ({ color }) => <Feather name="map" size={20} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="places"
        options={{
          title: 'МЕСТА',
          tabBarIcon: ({ color }) => <Feather name="compass" size={20} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'ПРОФИЛЬ',
          tabBarIcon: ({ color }) => <Feather name="user" size={20} color={color as string} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    // В макете панель — тёплый коричневый, заметно светлее карты, и кнопки
    // на нём лежат с одинаковым полем сверху и снизу.
    backgroundColor: palette.bark,
    borderTopWidth: 0,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    gap: spacing.sm,
  },
  item: {
    borderRadius: radii.md,
    borderWidth: 3,
    borderColor: palette.ink,
    marginHorizontal: 4,
    paddingVertical: spacing.xs,
  },
  label: { fontSize: 10, fontFamily: fonts.display, fontWeight: '900', letterSpacing: 1, marginBottom: 0 },
});
