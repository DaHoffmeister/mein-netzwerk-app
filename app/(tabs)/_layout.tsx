// app/(tabs)/_layout.tsx
// Layout für den eingeloggten Bereich — definiert die Tab-Leiste am unteren Bildschirmrand.

import { Tabs } from 'expo-router';
import { AntDesign } from '@expo/vector-icons';
import Entypo from '@expo/vector-icons/Entypo';
import Feather from '@expo/vector-icons/Feather';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
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
        headerStyle: { backgroundColor: theme.panel },
      }}
    >
      <Tabs.Screen name="index"   options={{ title: 'Home', headerShown: false, tabBarIcon: ({ color, size }) => <Entypo name="drink" size={size} color={color} /> }} />
      <Tabs.Screen name="chat"    options={{ title: 'Chats', headerShown: false, tabBarIcon: ({ color, size }) => <AntDesign name="branches" size={size} color={color} /> }} />
      <Tabs.Screen name="feed"    options={{ title: 'Feed', headerShown: false, tabBarIcon: ({ color, size }) => <Feather name="tv" size={size} color={color} /> }} />
      <Tabs.Screen name="events"  options={{ title: 'Events', headerShown: false, tabBarIcon: ({ color, size }) => <Entypo name="calendar" size={size} color={color} /> }} />
      <Tabs.Screen name="groups"  options={{ title: 'Gruppen', headerShown: false, tabBarIcon: ({ color, size }) => <FontAwesome name="group" size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil', headerShown: false, tabBarIcon: ({ color, size }) => <FontAwesome5 name="blind" size={size} color={color} /> }} />
    </Tabs>
  );
}
