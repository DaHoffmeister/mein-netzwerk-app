// lib/crypto/keyStore.ts
// Persistenter Speicher für E2E-Keys via expo-secure-store.
// Ersetzt IndexedDB aus der Web-App — SecureStore nutzt Keychain (iOS) / Keystore (Android).

import * as SecureStore from 'expo-secure-store';

const KEYS = {
  PRIVATE: 'e2e_private_key',
  PUBLIC: 'e2e_public_key',
  PRIV_HISTORY: 'e2e_priv_history', // JSON-Array von Base64-Strings
} as const;

function partnerKey(partnerId: number): string {
  return `e2e_partner_${partnerId}`;
}

// ── Eigener Private Key ────────────────────────────────────────────────────────

export async function savePrivateKey(base64: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.PRIVATE, base64);
}

export async function loadPrivateKey(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.PRIVATE);
}

export async function hasPrivateKey(): Promise<boolean> {
  return (await loadPrivateKey()) !== null;
}

// ── Eigener Public Key ─────────────────────────────────────────────────────────

export async function savePublicKey(base64: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.PUBLIC, base64);
}

export async function loadPublicKey(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.PUBLIC);
}

// ── Key-Rotation: Aktuellen Key archivieren ────────────────────────────────────

export async function archiveCurrentPrivateKey(): Promise<void> {
  const current = await loadPrivateKey();
  if (!current) return;
  const raw = await SecureStore.getItemAsync(KEYS.PRIV_HISTORY);
  const history: string[] = raw ? JSON.parse(raw) : [];
  if (!history.includes(current)) {
    history.unshift(current);
    if (history.length > 5) history.length = 5;
    await SecureStore.setItemAsync(KEYS.PRIV_HISTORY, JSON.stringify(history));
  }
}

export async function loadPrivateKeyHistory(): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(KEYS.PRIV_HISTORY);
  return raw ? JSON.parse(raw) : [];
}

// ── Partner Public Key Cache ───────────────────────────────────────────────────

export async function savePartnerPublicKey(partnerId: number, base64: string): Promise<void> {
  await SecureStore.setItemAsync(partnerKey(partnerId), base64);
}

export async function loadPartnerPublicKey(partnerId: number): Promise<string | null> {
  return SecureStore.getItemAsync(partnerKey(partnerId));
}

// ── Reset ─────────────────────────────────────────────────────────────────────

export async function clearAllKeys(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEYS.PRIVATE),
    SecureStore.deleteItemAsync(KEYS.PUBLIC),
    SecureStore.deleteItemAsync(KEYS.PRIV_HISTORY),
  ]);
}
