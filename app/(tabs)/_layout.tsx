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
        headerTintColor: theme.text,
        headerBackgroundContainerStyle: { backgroundColor: theme.panel },
      }}
    >
      <Tabs.Screen name="index"   options={{ title: 'Home' }} />
      <Tabs.Screen name="chat"    options={{ title: 'Chats', headerShown: false }} />
      <Tabs.Screen name="feed"    options={{ title: 'Feed', headerShown: false }} />
      <Tabs.Screen name="events"  options={{ title: 'Events', headerShown: false }} />
      <Tabs.Screen name="groups"  options={{ title: 'Gruppen', headerShown: false }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil', headerShown: false }} />
    </Tabs>
  );
}
