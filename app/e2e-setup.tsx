// app/e2e-setup.tsx
// Einmaliger Setup-Screen für den E2E-Schlüssel.
// Option A: Neues Schlüsselpaar generieren.
// Option B: Bestehendes Backup (von Web-App oder früherem Gerät) per PIN wiederherstellen.

import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../lib/ThemeContext';
import { useE2E } from '../lib/crypto/e2eContext';
import { e2eApi } from '../lib/api';
import {
  generateKeyPair, getPublicKeyFromPrivate,
  exportPublicKey, exportPrivateKeyRaw,
  deriveKeyFromPin, decryptPrivateKey,
} from '../lib/crypto/e2e';
import { savePrivateKey, savePublicKey } from '../lib/crypto/keyStore';

type Mode = 'choose' | 'generate' | 'restore';

export default function E2ESetupScreen() {
  const { theme }      = useTheme();
  const router         = useRouter();
  const { recheckKey } = useE2E();

  const [mode,     setMode]     = useState<Mode>('choose');
  const [pin,      setPin]      = useState('');
  const [busy,     setBusy]     = useState(false);
  const [status,   setStatus]   = useState('');

  // ── Option A: Neues Schlüsselpaar generieren ──────────────────

  async function handleGenerate() {
    setBusy(true);
    setStatus('Schlüsselpaar wird generiert…');

    try {
      // Schritt 1: Key generieren und lokal speichern
      const { privateKey, publicKey } = generateKeyPair();
      const privB64 = exportPrivateKeyRaw(privateKey);
      const pubB64  = exportPublicKey(publicKey);

      await savePrivateKey(privB64);
      await savePublicKey(pubB64);

      // Schritt 2: Public Key auf Server hochladen
      setStatus('Public Key wird hochgeladen…');
      await e2eApi.uploadPublicKey(pubB64);

      setStatus('Fertig!');
      await recheckKey();
      router.replace('/(tabs)');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[E2E Setup]', err);
      setStatus(`Fehler: ${msg}`);
    } finally {
      setBusy(false);
    }
  }

  // ── Option B: Backup wiederherstellen ─────────────────────────

  async function handleRestore() {
    if (pin.length < 4) { setStatus('PIN eingeben (mindestens 4 Zeichen).'); return; }
    setBusy(true);
    setStatus('Backup wird geladen…');

    try {
      const backup = await e2eApi.getKeyBackup();
      if (!backup.hasBackup || !backup.encryptedPrivateKey || !backup.iv || !backup.salt) {
        setStatus('Kein Backup auf dem Server gefunden. Bitte zuerst in der Web-App ein Backup erstellen.');
        setBusy(false);
        return;
      }

      setStatus('PIN wird verarbeitet… (kann einige Sekunden dauern)');
      await new Promise((r) => setTimeout(r, 80));
      const pinKey = deriveKeyFromPin(pin, backup.salt); // CPU-intensiv

      let privateKey: Uint8Array;
      try {
        privateKey = decryptPrivateKey(backup.encryptedPrivateKey, backup.iv, pinKey);
      } catch {
        setStatus('Falscher PIN oder beschädigtes Backup.');
        setBusy(false);
        return;
      }

      const pubBytes = getPublicKeyFromPrivate(privateKey);
      const pubB64   = exportPublicKey(pubBytes);
      const privB64  = exportPrivateKeyRaw(privateKey);

      await savePrivateKey(privB64);
      await savePublicKey(pubB64);

      setStatus('Public Key wird hochgeladen…');
      await e2eApi.uploadPublicKey(pubB64);

      setStatus('Wiederhergestellt!');
      await recheckKey();
      router.replace('/(tabs)');
    } catch (err) {
      console.error('[E2E Restore]', err);
      setStatus('Wiederherstellung fehlgeschlagen. Bitte nochmal versuchen.');
    } finally {
      setBusy(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.title, { color: theme.text }]}>Ende-zu-Ende Verschlüsselung</Text>
      <Text style={[styles.sub, { color: theme.textDim }]}>
        Für verschlüsselte Nachrichten brauchst du einen Schlüssel auf diesem Gerät.
        Der private Schlüssel verlässt das Gerät nie unverschlüsselt.
      </Text>

      {mode === 'choose' && (
        <View style={styles.btnGroup}>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: theme.brand }]}
            onPress={() => setMode('generate')}
          >
            <Text style={[styles.btnText, { color: theme.bg }]}>Neues Schlüsselpaar erstellen</Text>
            <Text style={[styles.btnHint, { color: theme.bg }]}>Erstmalige Einrichtung auf diesem Gerät</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnOutline, { borderColor: theme.brand }]}
            onPress={() => setMode('restore')}
          >
            <Text style={[styles.btnText, { color: theme.brand }]}>Von Backup wiederherstellen</Text>
            <Text style={[styles.btnHint, { color: theme.textDim }]}>Backup aus Web-App oder früherem Gerät</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={styles.skip}>
            <Text style={[styles.skipText, { color: theme.textDim }]}>Überspringen (Nachrichten bleiben verschlüsselt 🔒)</Text>
          </TouchableOpacity>
        </View>
      )}

      {mode === 'generate' && (
        <View style={styles.form}>
          <TouchableOpacity onPress={() => { setMode('choose'); setStatus(''); }}>
            <Text style={[styles.back, { color: theme.brand }]}>‹ Zurück</Text>
          </TouchableOpacity>

          <Text style={[styles.formTitle, { color: theme.text }]}>Neuen Schlüssel erstellen</Text>
          <Text style={[styles.sub, { color: theme.textDim }]}>
            Ein neues Schlüsselpaar wird generiert und sicher auf diesem Gerät gespeichert.
            Der öffentliche Schlüssel wird auf den Server hochgeladen, damit andere dir verschlüsselt schreiben können.
          </Text>

          {status !== '' && (
            <Text style={[styles.status, { color: status.includes('Fehler') ? '#ff6b6b' : theme.brand }]}>
              {status}
            </Text>
          )}

          {busy ? (
            <ActivityIndicator color={theme.brand} style={{ marginTop: 24 }} />
          ) : (
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: theme.brand }]}
              onPress={handleGenerate}
            >
              <Text style={[styles.btnText, { color: theme.bg }]}>Schlüssel erstellen</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {mode === 'restore' && (
        <View style={styles.form}>
          <TouchableOpacity onPress={() => { setMode('choose'); setStatus(''); setPin(''); }}>
            <Text style={[styles.back, { color: theme.brand }]}>‹ Zurück</Text>
          </TouchableOpacity>

          <Text style={[styles.formTitle, { color: theme.text }]}>Backup wiederherstellen</Text>

          <Text style={[styles.label, { color: theme.textDim }]}>PIN des bestehenden Backups:</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.panel, color: theme.text, borderColor: theme.muted }]}
            placeholder="PIN"
            placeholderTextColor={theme.textDim}
            value={pin}
            onChangeText={setPin}
            secureTextEntry
            keyboardType="numeric"
            maxLength={12}
            editable={!busy}
          />

          {status !== '' && (
            <Text style={[styles.status, { color: status.includes('Fehler') || status.includes('Falsch') || status.includes('Kein') ? '#ff6b6b' : theme.brand }]}>
              {status}
            </Text>
          )}

          {busy ? (
            <ActivityIndicator color={theme.brand} style={{ marginTop: 24 }} />
          ) : (
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: theme.brand }]}
              onPress={handleRestore}
            >
              <Text style={[styles.btnText, { color: theme.bg }]}>Wiederherstellen</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 24, paddingTop: 80, gap: 16 },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 8 },
  sub: { fontSize: 14, lineHeight: 20, marginBottom: 24 },
  btnGroup: { gap: 14 },
  btn: { borderRadius: 14, padding: 18, alignItems: 'center' },
  btnOutline: { borderRadius: 14, padding: 18, alignItems: 'center', borderWidth: 1.5 },
  btnText: { fontSize: 16, fontWeight: '700' },
  btnHint: { fontSize: 12, marginTop: 4, opacity: 0.75 },
  skip: { alignItems: 'center', paddingVertical: 12 },
  skipText: { fontSize: 13 },
  form: { gap: 10 },
  back: { fontSize: 16, marginBottom: 8 },
  formTitle: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  label: { fontSize: 13, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  status: { fontSize: 13, marginTop: 4, lineHeight: 18 },
});
