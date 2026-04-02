// app/(tabs)/_layout.tsx
// Layout für den eingeloggten Bereich — definiert die Tab-Leiste am unteren Bildschirmrand.
//
// Tabs-Navigation: Im Gegensatz zu Stack bleiben alle Tab-Screens im Speicher.
// Wechsel zwischen Tabs = kein Neu-Laden, sondern Ein-/Ausblenden.
//
// Jedes <Tabs.Screen> entspricht einer Datei in diesem Ordner:
//   name="index"   → (tabs)/index.tsx   → Route: /
//   name="feed"    → (tabs)/feed.tsx    → Route: /feed
//   usw.
//
// options={{ title: '...' }} setzt den Text unter dem Tab-Icon
// und den Header-Titel des jeweiligen Screens.

import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index"   options={{ title: 'Home' }} />
      <Tabs.Screen name="feed"    options={{ title: 'Feed' }} />
      <Tabs.Screen name="events"  options={{ title: 'Events' }} />
      <Tabs.Screen name="groups"  options={{ title: 'Gruppen' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil' }} />
    </Tabs>
  );
}
