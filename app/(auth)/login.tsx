// app/(auth)/login.tsx
// Login-Screen — sendet email + password ans Backend.
// Speichert Token (für API-Calls) und User-Objekt (für Auth-Guard) lokal.

import { useState } from 'react';
import { View, TextInput, Button, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../lib/api';
import { saveToken, saveUser } from '../../lib/auth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleLogin() {
    setError('');

    try {
      const res = await api.post('/auth/login', { email, password });

      await saveToken(res.data.token);      // JWT für API-Calls speichern
      await saveUser(res.data.user);        // User-Objekt für Auth-Guard speichern
      router.replace('/(tabs)');
    } catch {
      setError('Login fehlgeschlagen. Bitte prüfe E-Mail und Passwort.');
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mein Netzwerk</Text>
      <TextInput
        style={styles.input}
        placeholder="E-Mail"
        autoCapitalize="none"
        keyboardType="email-address"
        onChangeText={setEmail}
        value={email}
      />
      <TextInput
        style={styles.input}
        placeholder="Passwort"
        secureTextEntry
        onChangeText={setPassword}
        value={password}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Einloggen" onPress={handleLogin} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 32, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 16 },
  error: { color: 'red', marginBottom: 12 },
});
