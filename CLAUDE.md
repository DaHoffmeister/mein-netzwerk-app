# CLAUDE.md — mein-netzwerk-app

Dieser Leitfaden gilt für Claude Code beim Arbeiten in diesem Repository.

## Projektübersicht

**mein-netzwerk-app** ist die native Mobile App (Expo / React Native) für das soziale Netzwerk `assoz_net`. Sie verbindet sich gegen das Express-Backend auf dem Raspberry Pi unter `net.assozrpg.de`.

## Dev-Umgebung starten

```bash
# Im Browser testen (kein Build nötig)
npx expo start --web

# Auf dem Handy testen (bestehender Dev Build verbindet sich automatisch)
npx expo start

# Nur Metro Bundler, kein Browser
npx expo start --no-web
```

> EAS Builds nur wenn sich **native Module** ändern. Reines JS/TS = kein Build nötig.

## Tech-Stack

| Layer | Technologie |
|-------|-------------|
| Framework | Expo SDK 54 + React Native |
| Routing | Expo Router (dateibasiert) |
| HTTP | Axios (`lib/api.ts`) |
| Auth-Speicher | Expo SecureStore + localStorage (Web-Fallback) |
| Push | expo-notifications + Firebase FCM |
| Build | EAS Build (APK Sideload) |
| Sprache | TypeScript |

## Wichtige Dateien

- `app/_layout.tsx` — Auth-Guard, Root Layout
- `app/(auth)/login.tsx` — Login-Screen
- `app/(tabs)/` — Tab-Screens (Home, Feed, Events, Gruppen, Profil)
- `lib/api.ts` — Axios-Instanz, JWT-Interceptor
- `lib/auth.ts` — SecureStore read/write/delete
- `lib/notifications.ts` — Push-Token registrieren
- `lib/ThemeContext.tsx` — Theme-Provider
- `MILESTONES.md` — Projektfortschritt und Planung

## Backend-Verbindung

- Produktiv: `https://net.assozrpg.de/api`
- Lokal (Pi im Netz): `http://192.168.178.32:4000/api`
- Token kommt im **Response-Body** (`res.data.token`) — nicht nur als httpOnly Cookie (das wäre nur für Web)

## EAS Build-Infos

- Expo Account: `@kungill`
- Firebase Projekt: `assoz-net` | Bundle ID: `com.kungill.assoznetapp`
- `assoz-net-firebase-adminsdk-*.json` ist ein **Geheimnis** — nicht in Git!
- 15 kostenlose Builds/Monat auf Free-Tier

## Coding-Regeln

- `Platform.OS === 'web'` Checks für SecureStore → localStorage Fallback
- `router.replace()` statt `router.push()` für Auth-Flows
- Expo SecureStore funktioniert nicht im Browser — immer Platform-Check
- `newArchEnabled: false` in `app.json` für Expo Go Kompatibilität

## Dokumentationspflege

Nach jeder Session / nach Änderungen:
- `MILESTONES.md` aktualisieren: erledigte Punkte auf ✅ setzen, neue hinzufügen
- Phasenstatus aktuell halten
- Neue Erkenntnisse unter dem jeweiligen Meilenstein vermerken
