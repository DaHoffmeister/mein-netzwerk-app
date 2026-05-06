// lib/crypto/e2e.ts
// E2E-Verschlüsselung für React Native — pure JS, kein EAS-Build nötig.
// Algorithmen: ECDH P-256, AES-GCM 256, PBKDF2-SHA256 (kompatibel mit Web Crypto API).
// Packages: @noble/curves, @noble/ciphers, @noble/hashes

import { p256 } from '@noble/curves/nist.js';
import { gcm } from '@noble/ciphers/aes.js';
import { randomBytes } from '@noble/ciphers/utils.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';

// ── Base64 ────────────────────────────────────────────────────────────────────

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

// ── SPKI / PKCS8 (für Kompatibilität mit Web Crypto API Key-Format) ───────────

// 26-Byte Header für P-256 Public Keys im SPKI-Format
const SPKI_PREFIX = new Uint8Array([
  0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
  0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03, 0x42, 0x00,
]);

// 35-Byte Header für P-256 Private Keys im PKCS8-Format
const PKCS8_PREFIX = new Uint8Array([
  0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce,
  0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07,
  0x04, 0x27, 0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20,
]);

// ── Keypair ───────────────────────────────────────────────────────────────────

export type KeyPair = { privateKey: Uint8Array; publicKey: Uint8Array };

export function generateKeyPair(): KeyPair {
  const privateKey = p256.utils.randomSecretKey();
  const publicKey = p256.getPublicKey(privateKey, false); // 65 Bytes unkomprimiert
  return { privateKey, publicKey };
}

// Public Key aus Private Key ableiten (z.B. nach Backup-Wiederherstellung)
export function getPublicKeyFromPrivate(privateKey: Uint8Array): Uint8Array {
  return p256.getPublicKey(privateKey, false);
}

// Public Key → SPKI Base64 (Format, das das Backend und die Web-App erwarten)
export function exportPublicKey(publicKey: Uint8Array): string {
  const spki = new Uint8Array(SPKI_PREFIX.length + publicKey.length);
  spki.set(SPKI_PREFIX);
  spki.set(publicKey, SPKI_PREFIX.length);
  return bytesToBase64(spki);
}

// Private Key → Base64 (intern für SecureStore — raw 32 Bytes)
export function exportPrivateKeyRaw(privateKey: Uint8Array): string {
  return bytesToBase64(privateKey);
}

// Base64 → Private Key Bytes
export function importPrivateKeyRaw(base64: string): Uint8Array {
  return base64ToBytes(base64);
}

// SPKI Base64 → Public Key Bytes (65 Bytes unkomprimiert)
export function importPublicKey(spkiBase64: string): Uint8Array {
  const spki = base64ToBytes(spkiBase64);
  return spki.slice(SPKI_PREFIX.length); // SPKI-Header entfernen
}

// ── ECDH Shared Key ───────────────────────────────────────────────────────────

// X-Koordinate des ECDH-Punktes als 32-Byte AES-256 Key.
// Identisch zu Web Crypto API: deriveKey({ name: "ECDH" }, priv, { name: "AES-GCM", length: 256 })
export function deriveSharedKey(myPrivateKey: Uint8Array, theirPublicKey: Uint8Array): Uint8Array {
  const sharedPoint = p256.getSharedSecret(myPrivateKey, theirPublicKey, false);
  return sharedPoint.slice(1, 33); // x-Koordinate → AES-256 Key
}

// ── AES-GCM Verschlüsseln / Entschlüsseln ────────────────────────────────────

export function encryptMessage(
  plaintext: string,
  key: Uint8Array,
): { ciphertext: string; iv: string } {
  const iv = randomBytes(12);
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = gcm(key, iv).encrypt(encoded); // ciphertext + 16-Byte Auth-Tag
  return { ciphertext: bytesToBase64(ciphertext), iv: bytesToBase64(iv) };
}

export function decryptMessage(ciphertextB64: string, ivB64: string, key: Uint8Array): string {
  const ciphertext = base64ToBytes(ciphertextB64);
  const iv = base64ToBytes(ivB64);
  const decrypted = gcm(key, iv).decrypt(ciphertext);
  return new TextDecoder().decode(decrypted);
}

// ── PIN-basiertes Key-Backup ──────────────────────────────────────────────────

export function generateSalt(): string {
  return bytesToBase64(randomBytes(16));
}

// PBKDF2 ist synchron und CPU-intensiv (~2-4 Sek.) — nur mit Ladeindikator aufrufen.
export function deriveKeyFromPin(pin: string, saltBase64: string): Uint8Array {
  const salt = base64ToBytes(saltBase64);
  const pinBytes = new TextEncoder().encode(pin);
  return pbkdf2(sha256, pinBytes, salt, { c: 600_000, dkLen: 32 });
}

// Private Key (raw) → PKCS8 verschlüsselt (kompatibel mit Web-Backups)
export function encryptPrivateKey(
  privateKey: Uint8Array,
  pinKey: Uint8Array,
): { ciphertext: string; iv: string } {
  const pkcs8 = new Uint8Array(PKCS8_PREFIX.length + privateKey.length);
  pkcs8.set(PKCS8_PREFIX);
  pkcs8.set(privateKey, PKCS8_PREFIX.length);
  const iv = randomBytes(12);
  const ciphertext = gcm(pinKey, iv).encrypt(pkcs8);
  return { ciphertext: bytesToBase64(ciphertext), iv: bytesToBase64(iv) };
}

// Verschlüsselten PKCS8 Private Key entschlüsseln → raw 32-Byte Key
export function decryptPrivateKey(
  ciphertextB64: string,
  ivB64: string,
  pinKey: Uint8Array,
): Uint8Array {
  const ciphertext = base64ToBytes(ciphertextB64);
  const iv = base64ToBytes(ivB64);
  const pkcs8 = gcm(pinKey, iv).decrypt(ciphertext);
  return pkcs8.slice(PKCS8_PREFIX.length); // PKCS8-Header entfernen
}

// ── Gruppen-Key ───────────────────────────────────────────────────────────────

export function generateGroupKey(): Uint8Array {
  return randomBytes(32); // AES-256 Key
}

export function exportGroupKey(key: Uint8Array): string {
  return bytesToBase64(key);
}

export function importGroupKey(base64: string): Uint8Array {
  return base64ToBytes(base64);
}

// Gruppen-Key mit einem ECDH-SharedKey verschlüsseln → "ciphertext:iv" (base64)
export function wrapGroupKey(groupKeyBase64: string, sharedKey: Uint8Array): string {
  const { ciphertext, iv } = encryptMessage(groupKeyBase64, sharedKey);
  return `${ciphertext}:${iv}`;
}

// Gewrappten Gruppen-Key entschlüsseln → raw Uint8Array
export function unwrapGroupKey(wrappedKey: string, sharedKey: Uint8Array): Uint8Array {
  const colonIdx = wrappedKey.lastIndexOf(':');
  const ciphertext = wrappedKey.slice(0, colonIdx);
  const iv = wrappedKey.slice(colonIdx + 1);
  const groupKeyBase64 = decryptMessage(ciphertext, iv, sharedKey);
  return importGroupKey(groupKeyBase64);
}
