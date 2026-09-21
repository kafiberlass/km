import React from 'react';
import { StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { palette, radii, spacing } from '@/core/theme/tokens';

/**
 * Пять вкладок вместо четырёх: плитки ужались с 84 до 66 px, подписи —
 * до 9.5 px. Высота 58 px осталась: меньше нельзя, палец не попадёт.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.bar,
        tabBarItemStyle: styles.item,
        tabBarActiveTintColor: palette.textOnAqua,
        tabBarInactiveTintColor: palette.textIdleTab,
        tabBarActiveBackgroundColor: palette.aquaDeep,
        tabBarInactiveBackgroundColor: palette.glassIdleTop,
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
        name="achievements"
        options={{
          title: 'АЧИВКИ',
          tabBarIcon: ({ color }) => <Feather name="award" size={19} color={color as string} />,
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
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderTopWidth: 1,
    borderTopColor: palette.glassEdge,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    height: 80,
    paddingTop: 7,
    paddingHorizontal: 6,
  },
  item: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.glassEdge,
    marginHorizontal: 3,
    marginBottom: spacing.sm,
  },
  label: { fontSize: 9.5, fontWeight: '900', letterSpacing: 0.3 },
});
