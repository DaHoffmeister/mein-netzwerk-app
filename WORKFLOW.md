# Workflow — mein-netzwerk-app

## Entwicklungsumgebung starten

```bash
# Expo Metro Bundler starten (verbindet sich mit vorhandenem Dev Build auf dem Handy)
npx expo start

# Nur für Web-Tests im Browser
npx expo start --web
```

> **EAS Build nur nötig wenn sich native Module ändern** (z.B. neues Package mit nativen Bindings).
> Reine TypeScript-Änderungen funktionieren sofort ohne neuen Build.

---

## Dev Build auf Android testen

1. Dev Build ist als APK auf dem Handy installiert (APK Sideload)
2. `npx expo start` im Terminal
3. App öffnet sich automatisch oder QR-Code scannen
4. Hot-Reload läuft automatisch bei Code-Änderungen

**Build-Infos:**
- Expo Account: `@kungill`
- Firebase Projekt: `assoz-net` | Bundle ID: `com.kungill.assoznetapp`
- 15 kostenlose EAS Builds / Monat

---

## Backend (Raspberry Pi)

```bash
# SSH verbinden
ssh -i ~/.ssh/id_rsa pi@192.168.178.32

# Code aktualisieren und Container neu starten
cd ~/mein-netzwerk
git pull
docker compose restart backend
```

Der Backend-Container läuft unter `net.assozrpg.de` (nginx Reverse Proxy).

---

## E2E-Verschlüsselung einrichten (Erstnutzung)

**Wenn die App zum ersten Mal geöffnet wird (oder auf einem neuen Gerät):**

### Option A — Neues Gerät (kein Backup vorhanden)
1. App öffnen → Login → E2E-Setup-Screen erscheint automatisch (falls noch kein Key)
2. "Neues Schlüsselpaar erstellen" wählen
3. PIN eingeben (mind. 4 Stellen) + bestätigen
4. Warten (~3-5 Sek. für PBKDF2 + Upload)
5. Nachrichten werden ab sofort entschlüsselt

> Der Public Key wird automatisch hochgeladen (`PUT /api/users/me/public-key`).
> Ein PIN-geschütztes Backup wird auf dem Server gespeichert.

### Option B — Backup von Web-App wiederherstellen
1. Voraussetzung: In der Web-App unter "Signalzentrale → Schlüssel-Sicherheit" ein Backup erstellt
2. App → E2E-Setup-Screen → "Von Backup wiederherstellen"
3. Denselben PIN eingeben der beim Web-Backup verwendet wurde
4. Warten (~3-5 Sek.) → fertig

### Option C — Chat ohne Verschlüsselung nutzen
- "Überspringen" antippen
- Unverschlüsselte Nachrichten werden normal angezeigt
- Verschlüsselte Nachrichten zeigen weiterhin `🔒`

---

## Nachrichtenfluss

### Nachricht empfangen
```
WebSocket → raw Message mit { encrypted, ciphertext, iv }
         ↓
E2E Key ableiten (GroupKey für Gruppen, SharedKey für DMs)
         ↓
decryptMessage(ciphertext, iv, key) → Klartext
         ↓
setMessages() → UI zeigt Text
```

### Nachricht senden
```
User tippt Text
         ↓
isEncrypted? ja: encryptMessage(text, key) → { ciphertext, iv }
             nein: { text }
         ↓
WebSocket.send({ type: "messenger-message", conversationId, ...payload })
         ↓
REST Fallback wenn WS nicht offen: POST /messenger/conversations/:id/messages
```

---

## Bekannte Schwächen & To-Do

| Was | Status | Priorität |
|---|---|---|
| **Phase 4** Feed, Gruppen, Profil, Events in App bauen | Offen | Hoch |
| **Gruppe erstellen** in App (Key-Verteilung) | Offen | Mittel |
| **Key-Backup UI** (PIN ändern, Backup-Status anzeigen) | Offen | Mittel |
| **Phase 5** Android App Links | Offen | Niedrig |
| **PBKDF2 Blocking** — UI friert ~3 Sek. ein | Bekannt | Niedrig |
| Kein Typing-Indikator | Offen | Niedrig |

---

## Wichtige Dateipfade

| Datei | Zweck |
|---|---|
| `lib/crypto/e2e.ts` | Krypto-Primitiven (ECDH, AES-GCM, PBKDF2) |
| `lib/crypto/keyStore.ts` | Key-Persistenz via expo-secure-store |
| `lib/crypto/e2eContext.tsx` | React-Kontext (hasKey, recheckKey) |
| `lib/api.ts` | Axios HTTP-Client + messenger + e2eApi |
| `lib/auth.ts` | JWT SecureStore read/write |
| `lib/ThemeContext.tsx` | Theme-Provider (7 Themes) |
| `app/_layout.tsx` | Root Layout: Auth-Guard + E2EProvider |
| `app/(tabs)/chat.tsx` | Konversationsliste |
| `app/chat/[id].tsx` | Einzel-Chat mit E2E |
| `app/e2e-setup.tsx` | Key-Einrichtung (Neu / Restore) |
| `app/(tabs)/index.tsx` | Home / Counter |
| `MILESTONES.md` | Projektfortschritt |
| `E2E_DOKU.md` | E2E-Technische Dokumentation |

---

## Crypto Quick-Reference

```typescript
import { generateKeyPair, exportPublicKey, exportPrivateKeyRaw,
         deriveSharedKey, encryptMessage, decryptMessage,
         generateGroupKey, wrapGroupKey, unwrapGroupKey,
         generateSalt, deriveKeyFromPin, encryptPrivateKey, decryptPrivateKey,
         importPublicKey, importPrivateKeyRaw } from './lib/crypto/e2e';

import { savePrivateKey, loadPrivateKey, hasPrivateKey,
         savePublicKey, loadPublicKey,
         savePartnerPublicKey, loadPartnerPublicKey,
         archiveCurrentPrivateKey, loadPrivateKeyHistory,
         clearAllKeys } from './lib/crypto/keyStore';

// Neuen Key generieren
const { privateKey, publicKey } = generateKeyPair();
await savePrivateKey(exportPrivateKeyRaw(privateKey));
await savePublicKey(exportPublicKey(publicKey));

// ECDH Shared Key (für DMs)
const myPriv    = importPrivateKeyRaw(await loadPrivateKey());
const theirPub  = importPublicKey(partnerPublicKeySpkiBase64);
const sharedKey = deriveSharedKey(myPriv, theirPub);

// Verschlüsseln / Entschlüsseln
const { ciphertext, iv } = encryptMessage('Hallo', sharedKey);
const text = decryptMessage(ciphertext, iv, sharedKey);

// Gruppen-Key entschlüsseln
const groupKey = unwrapGroupKey(conv.encryptedGroupKey, sharedKey);
```

---

## Commits & Deployment

```bash
# Änderungen prüfen
git status
git diff

# Commit
git add lib/ app/
git commit -m "feat: E2E-Verschlüsselung für Mobile App"

# EAS Build (nur wenn native Module geändert)
eas build --platform android --profile development
```
