// lib/notifications.ts
// Push-Benachrichtigungen: Berechtigungen anfragen, Token holen, Backend registrieren

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import api from './api';

// Benachrichtigungen im Vordergrund anzeigen
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch {}

// Berechtigungen anfragen + Token holen + Backend registrieren
export async function registerForPushNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[Push] Berechtigungen verweigert');
    return;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
  const token = tokenData.data;
  console.log('[Push] Token:', token);

  await api.post('/counter/push/register', { token });
  console.log('[Push] Token im Backend registriert');
}
