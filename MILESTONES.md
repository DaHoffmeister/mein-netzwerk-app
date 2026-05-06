# Milestones — mein-netzwerk-app

> Automatisch gepflegt vom Dokumentations-Agenten. Letzte Aktualisierung: 2026-04-03

---

## Abgeschlossen ✅

### Phase 1 — Grundgerüst & Auth
- ✅ Expo SDK 54 + React Native + TypeScript Setup
- ✅ Expo Router: dateibasiertes Routing, Tab-Navigation
- ✅ `lib/api.ts`: Axios gegen `net.assozrpg.de` mit JWT-Interceptor
- ✅ `lib/auth.ts`: JWT in Expo SecureStore / localStorage (web fallback)
- ✅ Login-Screen: POST `/auth/login`, Token speichern
- ✅ Auth-Guard: nicht eingeloggt → Login (reagiert auf Segmente, nicht nur App-Start)
- ✅ 5 Tab-Screens als Platzhalter (Home, Feed, Events, Gruppen, Profil)

**Erkenntnisse:**
- Backend gibt Token im Response-Body zurück (für Mobile) + httpOnly Cookie (für Web)
- `router.replace()` statt `push()` damit Login-Screen nicht im Backstack bleibt
- `newArchEnabled: false` für Expo Go Kompatibilität nötig

### Phase 2 — Counter & Dev Build
- ✅ Counter-Feature: Sessions erstellen/beenden
- ✅ Konsum-Tracking: Bier, Wein, Shot, Cocktail, Joint, Line
- ✅ Statistiken-Tabelle pro Session
- ✅ Theme-System: 7 Themes, Persistenz via SecureStore
- ✅ Logout-Funktion im Profil-Screen
- ✅ EAS Development Build (APK) — läuft auf Android ohne Expo Go

### Phase 3 — Push-Benachrichtigungen
- ✅ `expo-notifications` installiert
- ✅ Firebase FCM V1 Service Account in Expo Credentials hinterlegt
- ✅ `google-services.json` eingebunden (Firebase-Projekt: `assoz-net`)
- ✅ Push-Token beim Login registrieren → Backend (`/counter/push/register`)
- ✅ Benachrichtigungen empfangen (Foreground + Background)

---

### Phase 6 — Chat / Messenger mit E2E ✅ Implementiert (2026-05-06)
- ✅ `app/(tabs)/chat.tsx`: Konversationsliste (DMs + Gruppen, Ungelesen-Indikator, 🔒-Markierung)
- ✅ `app/chat/[id].tsx`: Einzel-Chat mit Bubbles, WebSocket, REST-Fallback
- ✅ `lib/crypto/e2e.ts`: ECDH P-256 + AES-GCM 256 + PBKDF2 (pure JS, @noble-Libraries)
- ✅ `lib/crypto/keyStore.ts`: Key-Persistenz via expo-secure-store (Keychain/Keystore)
- ✅ `lib/crypto/e2eContext.tsx`: React-Kontext für Key-Status
- ✅ `app/e2e-setup.tsx`: Key-Einrichtung (Neu generieren oder von Web-Backup wiederherstellen)
- ✅ Web/Mobile Backup-Kompatibilität (PKCS8/SPKI-Format, gleiche Algorithmen)
- ✅ `E2E_DOKU.md` + `WORKFLOW.md` erstellt
- 🔲 **Noch zu testen**: Erster Live-Test mit echtem Key-Austausch und Entschlüsselung
- 🔲 **Noch offen**: Gruppe in App erstellen (Key-Verteilung), Backup-Status UI

**Erkenntnisse:**
- `crypto.subtle` (Web Crypto API) existiert nicht in Hermes/React Native → @noble-Libraries als Drop-in
- `IndexedDB` → `expo-secure-store` (bereits im Projekt vorhanden, kein Extra-Paket)
- Import-Pfade für @noble: `@noble/curves/nist.js`, `@noble/ciphers/aes.js`, etc.
- PBKDF2 (600.000 Iterationen) blockiert JS-Thread ~3-4 Sek. — Ladeindikator nötig
- Kein EAS Build nötig — pure JS

---

## In Arbeit / Offen 🔲

### Phase 4a — Kern-Features (nächste Phase)

#### Feed
- 🔲 Posts laden & anzeigen (Infinite Scroll, Cursor-Pagination)
- 🔲 Post erstellen (Text + optional Bild)
- 🔲 Post bearbeiten & löschen (eigene Posts)
- 🔲 Reaktionen (ME_LAIK, NOOOT, BUS, SLAP, TUSS_HOT_ODER_IRRE_ICH_MICH) — Toggle & Replace
- 🔲 Kommentare anzeigen, schreiben, löschen

#### Gruppen
- 🔲 Gruppenliste anzeigen (Name, Beschreibung, Mitgliederzahl)
- 🔲 Gruppe beitreten / verlassen
- 🔲 Gruppe erstellen (Name, Beschreibung)
- 🔲 Gruppen-Posts lesen & schreiben
- 🔲 Gruppen-Reaktionen (👍 ❤️ 😂 🔥 😮)
- 🔲 Gruppen-Kommentare

#### Profil
- 🔲 Eigenes Profil anzeigen (Avatar, Bio, Gruppen)
- 🔲 Bio bearbeiten
- 🔲 Avatar hochladen
- 🔲 Passwort ändern
- 🔲 Fremde Profile anzeigen (Avatar, Bio, Gruppen)

#### Events
- 🔲 Event-Liste anzeigen (Datum, Titel, Ort)
- 🔲 Event-Detail (Beschreibung, RSVPs)
- 🔲 RSVP (Zusagen / Absagen)
- 🔲 Event erstellen

### Phase 4b — Erweiterte Features (nach 4a)
- 🔲 Gruppendetails: Ressourcen, Dateien, Videos
- 🔲 Quests / Projekte in Gruppen
- 🔲 Mentions-Center im Profil
- 🔲 Admin-Funktionen (Invite Links, User-Verwaltung)

### Phase 5 — Android App Links
- 🔲 `/.well-known/assetlinks.json` auf dem Pi hinterlegen
- 🔲 `intentFilters` in `app.json` für `net.assozrpg.de`
- 🔲 Neuer EAS Build

### Phase 7 — Kamera-Streaming (Mobile)
- 🔲 `react-native-webrtc` installieren (EAS Build nötig)
- 🔲 Kamera- & Mikrofon-Permissions in `app.json`
- 🔲 Neuer Stream-Screen: Kamera starten, Room erstellen/joinen
- 🔲 Bestehenden Signaling-Server (WebSocket) der Web-App wiederverwenden
- 🔲 Viewer-Modus: anderen Streams auf dem Handy zuschauen
- ℹ️ Screen-Sharing auf iOS stark eingeschränkt — nur Kamera realistisch

---

## Technische Infos

| Service | Detail |
|---------|--------|
| Expo Account | @kungill |
| Firebase Projekt | `assoz-net` |
| Bundle ID | `com.kungill.assoznetapp` |
| Backend | `net.assozrpg.de` (Raspberry Pi) |
| Builds verbraucht | 2 heute (Stand 2026-04-03), 13 verbleibend bis Montag |

## Nächster Schritt

**Phase 4 starten** — Feed-Screen mit echten Posts aus `/api/posts`  
Kein neuer EAS-Build nötig: bestehender Dev Build + `npx expo start`
