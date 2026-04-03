// lib/ThemeContext.tsx
// Theme-Context: aktives Theme laden, wechseln, speichern

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { THEMES, DEFAULT_THEME, type Theme } from './themes';

const STORAGE_KEY = 'app_theme';

async function loadThemeKey(): Promise<string | null> {
  if (Platform.OS === 'web') return localStorage.getItem(STORAGE_KEY);
  return SecureStore.getItemAsync(STORAGE_KEY);
}

async function saveThemeKey(key: string): Promise<void> {
  if (Platform.OS === 'web') { localStorage.setItem(STORAGE_KEY, key); return; }
  await SecureStore.setItemAsync(STORAGE_KEY, key);
}

type ThemeContextType = {
  theme: Theme;
  setTheme: (key: string) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextType>({
  theme: DEFAULT_THEME,
  setTheme: async () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

  useEffect(() => {
    loadThemeKey().then((saved) => {
      if (saved) {
        const found = THEMES.find((t) => t.key === saved);
        if (found) setThemeState(found);
      }
    });
  }, []);

  async function setTheme(key: string) {
    const found = THEMES.find((t) => t.key === key);
    if (!found) return;
    setThemeState(found);
    await saveThemeKey(key);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
