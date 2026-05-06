// app/_layout.tsx
// Root Layout — Auth-Guard + E2E-Provider.
// Reihenfolge: Auth prüfen → dann E2E-Key prüfen → App starten.

// crypto.getRandomValues polyfill — muss vor allen @noble-Imports geladen sein
import 'react-native-get-random-values';

import { useEffect, useRef } from 'react';
import { Stack, useRouter, useRootNavigationState, useSegments } from 'expo-router';
import { getUser, deleteToken, deleteUser } from '../lib/auth';
import { ThemeProvider } from '../lib/ThemeContext';
import { E2EProvider } from '../lib/crypto/e2eContext';
import { hasPrivateKey } from '../lib/crypto/keyStore';
import api from '../lib/api';

export default function RootLayout() {
  const router          = useRouter();
  const navigationState = useRootNavigationState();
  const segments        = useSegments();
  const checked         = useRef(false);

  useEffect(() => {
    if (!navigationState?.key) return;
    if (checked.current) return;
    checked.current = true;

    async function checkAuth() {
      const user = await getUser();
      const inAuthGroup  = segments[0] === '(auth)';
      const inSetupGroup = segments[0] === 'e2e-setup';

      if (!user) {
        if (!inAuthGroup) router.replace('/(auth)/login');
        return;
      }

      try {
        await api.get('/auth/me');
        if (inAuthGroup) {
          router.replace('/(tabs)');
        } else if (!inSetupGroup) {
          // Key-Check: bei fehlendem E2E-Key → Setup-Screen
          const keyExists = await hasPrivateKey();
          if (!keyExists) router.replace('/e2e-setup');
        }
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
      <E2EProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </E2EProvider>
    </ThemeProvider>
  );
}
