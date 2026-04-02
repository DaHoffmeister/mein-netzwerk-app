// lib/auth.ts
// Speichert JWT-Token und User-Objekt nach dem Login.
//
// Das Backend setzt einen httpOnly-Cookie (für die Web-App)
// UND gibt den Token im Response-Body zurück (für die Mobile App).
// Wir nutzen den Token aus dem Body und speichern ihn sicher.
//
// Auf Web: localStorage (SecureStore nicht verfügbar im Browser)
// Auf Native (iOS/Android): expo-secure-store (verschlüsselter Keychain)

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'jwt_token';
const USER_KEY  = 'current_user';

// --- Token ---

export async function saveToken(token: string) {
  if (Platform.OS === 'web') { localStorage.setItem(TOKEN_KEY, token); return; }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') return localStorage.getItem(TOKEN_KEY);
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function deleteToken() {
  if (Platform.OS === 'web') { localStorage.removeItem(TOKEN_KEY); return; }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

// --- User ---

export async function saveUser(user: object) {
  const json = JSON.stringify(user);
  if (Platform.OS === 'web') { localStorage.setItem(USER_KEY, json); return; }
  await SecureStore.setItemAsync(USER_KEY, json);
}

export async function getUser(): Promise<object | null> {
  let json: string | null = null;
  if (Platform.OS === 'web') { json = localStorage.getItem(USER_KEY); }
  else { json = await SecureStore.getItemAsync(USER_KEY); }
  return json ? JSON.parse(json) : null;
}

export async function deleteUser() {
  if (Platform.OS === 'web') { localStorage.removeItem(USER_KEY); return; }
  await SecureStore.deleteItemAsync(USER_KEY);
}
