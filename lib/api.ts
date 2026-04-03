// lib/api.ts
// Zentraler HTTP-Client für alle API-Calls gegen das Backend.
// Hängt vor jedem Request automatisch den JWT als Bearer-Token an.

import axios from 'axios';
import { Platform } from 'react-native';
import { getToken } from './auth';

const api = axios.create({
  baseURL: 'https://net.assozrpg.de/api',
  withCredentials: Platform.OS === 'web', // Cookie nur für Web-App
});

// Vor jedem Request: Token holen und als Authorization-Header anhängen
api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
