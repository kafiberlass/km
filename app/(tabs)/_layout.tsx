import React from 'react';
import { StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts, line, palette } from '@/core/theme/tokens';

/**
 * Размеры кнопок — из макета: плитка 58 в высоту, скругление 15,
 * иконка 19, подпись 9,5 и три пункта между ними.
 *
 * Скругление именно 15, а не «таблеткой»: в макете плитки почти
 * прямоугольные, и от этого панель выглядит собранной, а не как четыре
 * овала подряд.
 */
const ITEM_HEIGHT = 58;
const BAR_PADDING = 6;

/** Высота панели без учёта жеста «домой»: плитка плюс поля вокруг неё. */
const BAR_HEIGHT = ITEM_HEIGHT + BAR_PADDING * 2;

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
        tabBarStyle: [styles.bar, { height: BAR_HEIGHT + bottomInset }],
        tabBarItemStyle: styles.item,
        // Активная — синяя плитка с белой подписью, как в макете.
        // Лайм там оставлен кнопке прогулки: две лаймовые вещи на экране
        // спорили бы за внимание.
        tabBarActiveTintColor: palette.parchmentBright,
        tabBarInactiveTintColor: palette.textDark,
        tabBarActiveBackgroundColor: palette.bark,
        tabBarInactiveBackgroundColor: palette.parchmentBright,
        tabBarLabelStyle: styles.label,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'КАРТА',
          tabBarIcon: ({ color }) => <Feather name="map" size={19} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="places"
        options={{
          title: 'МЕСТА',
          tabBarIcon: ({ color }) => <Feather name="compass" size={19} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'ДРУЗЬЯ',
          tabBarIcon: ({ color }) => <Feather name="users" size={19} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'ПРОФИЛЬ',
          tabBarIcon: ({ color }) => <Feather name="user" size={19} color={color as string} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    // Стеклянная панель: светлая вода под кнопками, тонкий блик по верхней
    // кромке. Прежде здесь был тёплый коричневый из старого макета.
    backgroundColor: palette.sand,
    borderTopWidth: line,
    borderTopColor: palette.edge,
    paddingTop: BAR_PADDING,
    paddingHorizontal: BAR_PADDING,
  },
  item: {
    height: ITEM_HEIGHT,
    borderRadius: 15,
    borderWidth: line,
    borderColor: palette.edge,
    overflow: 'hidden',
    marginHorizontal: 3,
  },
  label: {
    fontSize: 9.5,
    fontFamily: fonts.display,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 0,
  },
});
