import React from 'react';
import { StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { palette, radii, spacing } from '@/core/theme/tokens';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.bar,
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
        name="achievements"
        options={{
          title: 'АЧИВКИ',
          tabBarIcon: ({ color }) => <Feather name="award" size={20} color={color as string} />,
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
    backgroundColor: palette.fogSoft,
    borderTopWidth: 0,
    height: 78,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    gap: spacing.sm,
  },
  item: {
    borderRadius: radii.md,
    borderWidth: 3,
    borderColor: palette.ink,
    marginHorizontal: 4,
    marginBottom: spacing.md,
  },
  label: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
});
