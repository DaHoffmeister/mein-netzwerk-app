// app/_layout.tsx
// Root Layout — Auth-Guard der App.
//
// Bei jeder Routenänderung wird geprüft ob ein User gespeichert ist.
// So funktioniert Login und Logout sofort ohne veralteten State.

import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { getUser } from '../lib/auth';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    getUser().then((user) => {
      const isLoggedIn = !!user;
      const inAuthGroup = segments[0] === '(auth)';

      if (!isLoggedIn && !inAuthGroup) {
        // Kein User gespeichert → zum Login
        router.replace('/(auth)/login');
      } else if (isLoggedIn && inAuthGroup) {
        // User vorhanden, aber noch auf Login-Seite → zu den Tabs
        router.replace('/(tabs)');
      }
    });
  }, [segments]);

  return <Slot />;
}
