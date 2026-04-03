// app/(tabs)/_layout.tsx
// Layout für den eingeloggten Bereich — definiert die Tab-Leiste am unteren Bildschirmrand.

import { Tabs } from 'expo-router';
import { useTheme } from '../../lib/ThemeContext';

export default function TabLayout() {
  const { theme } = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: theme.tabBar, borderTopColor: theme.muted },
        tabBarActiveTintColor: theme.tabActive,
        tabBarInactiveTintColor: theme.tabInactive,
        headerStyle: { backgroundColor: theme.panel },
        headerTintColor: theme.text,
      }}
    >
      <Tabs.Screen name="index"   options={{ title: 'Home' }} />
      <Tabs.Screen name="feed"    options={{ title: 'Feed' }} />
      <Tabs.Screen name="events"  options={{ title: 'Events' }} />
      <Tabs.Screen name="groups"  options={{ title: 'Gruppen' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil' }} />
    </Tabs>
  );
}
