// app/_layout.tsx
// Root Layout — Auth-Guard der App.
//
// Bei jeder Routenänderung wird geprüft ob ein User gespeichert ist.
// So funktioniert Login und Logout sofort ohne veralteten State.

import { useEffect, useRef } from 'react';
import { Slot, useRouter, useRootNavigationState, useSegments } from 'expo-router';
import { getUser, deleteToken, deleteUser } from '../lib/auth';
import { ThemeProvider } from '../lib/ThemeContext';
import api from '../lib/api';

export default function RootLayout() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const segments = useSegments();
  const checked = useRef(false);

  useEffect(() => {
    if (!navigationState?.key) return; // Router noch nicht bereit
    if (checked.current) return;
    checked.current = true;

    async function checkAuth() {
      const user = await getUser();
      const inAuthGroup = segments[0] === '(auth)';

      if (!user) {
        if (!inAuthGroup) router.replace('/(auth)/login');
        return;
      }

      try {
        await api.get('/auth/me');
        if (inAuthGroup) router.replace('/(tabs)');
      } catch {
        await deleteToken();
        await deleteUser();
        router.replace('/(auth)/login');
      }
    }

    checkAuth();
  }, [navigationState?.key]);

  return (
    <ThemeProvider>
      <Slot />
    </ThemeProvider>
  );
}
