# Phase 1 — Grundgerüst & Auth
## Expo Router + Tab-Navigation + Login mit JWT

---

## Ziel dieser Phase

Die App soll beim Start prüfen, ob der User eingeloggt ist:
- **Nicht eingeloggt** → Login-Screen
- **Eingeloggt** → Tab-Navigation mit 5 Screens

```
App startet
  ↓
Ist JWT im SecureStore?
  ├── NEIN → Login-Screen
  └── JA  → Tab-Navigation
              ├── Home
              ├── Feed
              ├── Events
              ├── Gruppen
              └── Profil
```

---

## Schritt 1 — Pakete installieren

```bash
npx expo install expo-router expo-secure-store axios
```

| Paket | Zweck |
|-------|-------|
| `expo-router` | Dateibasiertes Routing (wie Next.js) |
| `expo-secure-store` | Verschlüsselter Tokenspeicher auf dem Gerät |
| `axios` | HTTP-Client mit automatischem JSON-Parsing und Interceptors |

---

## Schritt 2 — Konfiguration anpassen

### `package.json` — Entry-Point ändern

```json
"main": "expo-router/entry"
```

**Warum?** Ohne diese Änderung startet Expo mit dem Standard-Entry (`index.ts`).
Expo Router muss aber selbst der Entry-Point sein, damit es das Routing übernehmen kann.

### `app.json` — Scheme hinzufügen

```json
"scheme": "mein-netzwerk"
```

**Warum?** Das ist der Deep-Link-Name der App (`mein-netzwerk://`).
Expo Router braucht das für interne Navigation zwischen Screens.

> Expo Router trägt sich außerdem automatisch in `plugins` ein — das passiert beim Install.

---

## Schritt 3 — Ordnerstruktur

```
app/
  _layout.tsx          → Root Layout: Auth-Guard, Startpunkt der App
  (auth)/
    _layout.tsx        → Layout für nicht-eingeloggte Screens
    login.tsx          → Login-Screen
  (tabs)/
    _layout.tsx        → Tab-Leiste definieren
    index.tsx          → Home-Tab
    feed.tsx           → Feed-Tab
    events.tsx         → Events-Tab
    groups.tsx         → Gruppen-Tab
    profile.tsx        → Profil-Tab

lib/
  auth.ts              → JWT lesen/schreiben/löschen (SecureStore)
  api.ts               → Axios-Instanz mit Auth-Interceptor
```

### Was bedeuten die Klammern `(auth)` und `(tabs)`?

Das sind **Route Groups**. Der Ordnername in Klammern erscheint **nicht** in der URL.

- `app/(auth)/login.tsx` → Route: `/login` (nicht `/auth/login`)
- `app/(tabs)/feed.tsx` → Route: `/feed` (nicht `/tabs/feed`)

Zweck: Dateien logisch gruppieren, ohne die URL zu beeinflussen.

---

## Schritt 4 — `lib/auth.ts`

```ts
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'jwt_token';

export async function saveToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function deleteToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
```

**Warum SecureStore statt AsyncStorage?**

| | AsyncStorage | SecureStore |
|-|-------------|-------------|
| Verschlüsselung | Nein | Ja |
| Speicherort | Klartext auf dem Gerät | iOS Keychain / Android Keystore |
| Geeignet für | unkritische Daten | Tokens, Passwörter |

---

## Schritt 5 — `lib/api.ts`

```ts
import axios from 'axios';
import { getToken } from './auth';

const api = axios.create({
  baseURL: 'https://net.assozrpg.de/api',
});

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
```

**Was ist ein Interceptor?**
Eine Funktion, die automatisch vor oder nach jedem API-Call ausgeführt wird.
Der Request-Interceptor hier holt den JWT und hängt ihn als Header an —
so muss das in keinem einzelnen API-Call manuell gemacht werden.

**Warum `Bearer`?**
Das ist ein HTTP-Standard. Das Backend erwartet:
`Authorization: Bearer eyJhbGci...`

---

## Schritt 6 — `app/_layout.tsx` (Auth-Guard)

```ts
import { useEffect, useState } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { getToken } from '../lib/auth';

export default function RootLayout() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    getToken().then((token) => setIsLoggedIn(!!token));
  }, []);

  useEffect(() => {
    if (isLoggedIn === null) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isLoggedIn && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isLoggedIn && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isLoggedIn, segments]);

  return <Slot />;
}
```

**Wichtige Konzepte:**

| Konzept | Erklärung |
|---------|-----------|
| `useState<boolean \| null>` | `null` = Prüfung läuft noch, `true/false` = Ergebnis |
| `useSegments()` | Aktueller Pfad als Array: `['(tabs)', 'feed']` |
| `useRouter()` | Programmatische Navigation |
| `router.replace()` | Navigation ohne Zurück-Button (Login bleibt nicht im Stack) |
| `<Slot />` | Platzhalter für die aktuell aktive Route (wie `{children}` in Next.js) |
| `!!token` | Doppeltes Ausrufezeichen: wandelt String/null in boolean um |

**Warum zwei separate `useEffect`s?**
Der erste läuft einmalig beim Start (leeres Dependency-Array `[]`).
Der zweite reagiert auf Änderungen — z.B. wenn `isLoggedIn` von `null` auf `true` wechselt.
Alles in einen zu packen würde die Logik vermischen.

---

## Schritt 7 — `app/(auth)/_layout.tsx`

```ts
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

**Stack vs. Tabs:**

| Stack | Tabs |
|-------|------|
| Screens übereinander gestapelt | Screens nebeneinander |
| Neuer Screen schiebt sich von rechts | Sofortiger Wechsel |
| Zurück-Button möglich | Kein Zurück zwischen Tabs |
| Gut für: Flows (Login → Register) | Gut für: Hauptbereiche der App |

---

## Schritt 8 — `app/(auth)/login.tsx`

```ts
async function handleLogin() {
  setError('');
  try {
    const res = await api.post('/auth/login', { username, password });
    await saveToken(res.data.token);
    router.replace('/(tabs)');
  } catch {
    setError('Login fehlgeschlagen...');
  }
}
```

**Ablauf:**
1. POST `/api/auth/login` mit `{ username, password }`
2. Backend antwortet mit `{ token: "eyJ..." }`
3. Token im SecureStore speichern
4. Mit `router.replace('/(tabs)')` zu den Tabs wechseln
5. Der Auth-Guard im Root Layout erkennt den neuen Token

**Warum `replace` statt `push`?**
`push` fügt den Login-Screen zum Stack hinzu. Der User könnte dann
mit dem Zurück-Button wieder zum Login navigieren — das wollen wir nicht.
`replace` ersetzt den aktuellen Screen, er verschwindet aus dem Stack.

---

## Schritt 9 — `app/(tabs)/_layout.tsx`

```ts
import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index"   options={{ title: 'Home' }} />
      <Tabs.Screen name="feed"    options={{ title: 'Feed' }} />
      <Tabs.Screen name="events"  options={{ title: 'Events' }} />
      <Tabs.Screen name="groups"  options={{ title: 'Gruppen' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil' }} />
    </Tabs>
  );
}
```

`name` muss exakt dem Dateinamen entsprechen (ohne `.tsx`).
`title` erscheint als Text unter dem Tab-Icon und als Header-Titel.

---

## App testen

```bash
npx expo start
```

1. QR-Code mit der **Expo Go App** scannen (kostenlos im App Store / Play Store)
2. App startet → kein Token vorhanden → Login-Screen erscheint
3. Mit gültigen Zugangsdaten einloggen → Tab-Navigation erscheint
4. App schließen und neu öffnen → Token ist noch da → direkt auf Tabs

---

## Nächste Phase

Phase 2 baut auf diesem Grundgerüst auf:
- Home: Joint Counter (neuer Backend-Endpoint)
- Feed: Posts aus der API anzeigen
- Gruppen: Liste + Detail-Screen
- Profil: eigene Daten + Gruppen-Badges
