// app/(auth)/login.tsx
// Login-Screen — Theme-farbig mit Theme-Logo

import { useState } from 'react';
import {
  View, TextInput, Text, StyleSheet, TouchableOpacity,
  Image, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../lib/api';
import { saveToken, saveUser } from '../../lib/auth';
import { useTheme } from '../../lib/ThemeContext';
import { THEMES } from '../../lib/themes';

export default function LoginScreen() {
  const { theme, setTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleLogin() {
    setError('');
    try {
      const res = await api.post('/auth/login', { email, password });
      await saveToken(res.data.token);
      await saveUser(res.data.user);
      router.replace('/(tabs)');
    } catch {
      setError('Login fehlgeschlagen. Bitte prüfe E-Mail und Passwort.');
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.outer, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Logo */}
        <Image source={theme.logo} style={styles.logo} resizeMode="contain" />

        {/* Titel */}
        <Text style={[styles.title, { color: theme.brand }]}>Mein Netzwerk</Text>
        <Text style={[styles.subtitle, { color: theme.textDim }]}>Willkommen zurück</Text>

        {/* Eingabefelder */}
        <View style={styles.form}>
          <TextInput
            style={[styles.input, { borderColor: theme.muted, color: theme.text, backgroundColor: theme.panel }]}
            placeholder="E-Mail"
            placeholderTextColor={theme.textDim}
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={setEmail}
            value={email}
          />
          <TextInput
            style={[styles.input, { borderColor: theme.muted, color: theme.text, backgroundColor: theme.panel }]}
            placeholder="Passwort"
            placeholderTextColor={theme.textDim}
            secureTextEntry
            onChangeText={setPassword}
            value={password}
          />
          {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.brand }]}
            onPress={handleLogin}
          >
            <Text style={[styles.buttonText, { color: theme.bg }]}>Einloggen</Text>
          </TouchableOpacity>
        </View>

        {/* Theme-Schnellwahl */}
        <Text style={[styles.themeHint, { color: theme.textDim }]}>Theme wählen</Text>
        <View style={styles.themeRow}>
          {THEMES.map((t) => (
            <TouchableOpacity
              key={t.key}
              onPress={() => setTheme(t.key)}
              style={[
                styles.themeChip,
                { borderColor: t.key === theme.key ? theme.brand : theme.muted },
              ]}
            >
              <Text style={styles.themeChipEmoji}>{t.emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 28 },

  logo: { width: 120, height: 120, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 14, textAlign: 'center', marginBottom: 32 },

  form: { gap: 12 },
  input: { borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 16 },
  error: { fontSize: 14, textAlign: 'center' },

  button: { borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 4 },
  buttonText: { fontWeight: 'bold', fontSize: 16 },

  themeHint: { textAlign: 'center', marginTop: 36, marginBottom: 12, fontSize: 13 },
  themeRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, flexWrap: 'wrap' },
  themeChip: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  themeChipEmoji: { fontSize: 22 },
});
