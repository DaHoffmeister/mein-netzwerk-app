// lib/api.ts
// Zentraler HTTP-Client für alle API-Calls gegen das Backend.
// Hängt vor jedem Request automatisch den JWT als Bearer-Token an.

import axios from 'axios';
import { Platform } from 'react-native';
import { getToken } from './auth';

const api = axios.create({
  baseURL: 'https://net.assozrpg.de/api',
  withCredentials: Platform.OS === 'web',
});

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Messenger ────────────────────────────────────────────────────────────────

export const messenger = {
  conversations: () =>
    api.get('/messenger/conversations').then((r) => r.data),

  messages: (convId: number, before?: string) =>
    api.get(`/messenger/conversations/${convId}/messages`, {
      params: { limit: 50, ...(before ? { before } : {}) },
    }).then((r) => r.data),

  send: (convId: number, body: Record<string, unknown>) =>
    api.post(`/messenger/conversations/${convId}/messages`, body).then((r) => r.data),

  markRead: (convId: number) =>
    api.post(`/messenger/conversations/${convId}/read`).then((r) => r.data),

  createDM: (targetUserId: number) =>
    api.post('/messenger/conversations', { targetUserId }).then((r) => r.data),

  setGroupKeys: (convId: number, keys: { userId: number; encryptedKey: string }[]) =>
    api.put(`/messenger/conversations/${convId}/group-keys`, { keys }).then((r) => r.data),
};

// ── User-Suche ───────────────────────────────────────────────────────────────

export const usersApi = {
  all: () =>
    api.get('/users').then((r) => r.data) as Promise<{ id: number; username: string }[]>,
};

// ── E2E Key-Verwaltung ───────────────────────────────────────────────────────

export const e2eApi = {
  uploadPublicKey: (publicKey: string) =>
    api.put('/users/me/public-key', { publicKey }).then((r) => r.data),

  getPublicKey: (userId: number) =>
    api.get(`/users/${userId}/public-key`).then((r) => r.data) as Promise<{ publicKey: string }>,

  getKeyBackup: () =>
    api.get('/users/me/key-backup').then((r) => r.data) as Promise<{
      hasBackup: boolean;
      encryptedPrivateKey?: string;
      iv?: string;
      salt?: string;
    }>,

  uploadKeyBackup: (encryptedPrivateKey: string, iv: string, salt: string) =>
    api.put('/users/me/key-backup', { encryptedPrivateKey, iv, salt }).then((r) => r.data),
};

export default api;
