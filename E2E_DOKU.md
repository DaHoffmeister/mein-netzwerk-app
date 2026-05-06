# E2E-Verschlüsselung — Mobile App Dokumentation

## Überblick

Die Mobile App implementiert dieselbe Ende-zu-Ende-Verschlüsselung wie die Web-App auf `assoz_net`. Nachrichten können nur von den beteiligten Geräten gelesen werden — der Server sieht nur Ciphertext.

**Wichtig:** Backups sind zwischen Web und Mobile vollständig kompatibel. Wer auf der Web-App ein Backup erstellt hat, kann es auf dem Handy wiederherstellen — und umgekehrt.

---

## Algorithmen

| Aufgabe | Algorithmus | Parameter |
|---|---|---|
| Schlüsselaustausch | ECDH P-256 | — |
| Nachrichtenverschlüsselung | AES-GCM | 256 Bit, 12 Byte IV |
| Gruppen-Key-Verteilung | AES-GCM (mit ECDH-SharedKey) | — |
| PIN-Backup | PBKDF2-SHA256 | 600.000 Iterationen, 16 Byte Salt |

---

## Technische Implementierung

### Pakete (pure JS — kein EAS Build nötig)

```
@noble/curves  — ECDH P-256 Schlüsselerzeugung und Shared-Secret-Berechnung
@noble/ciphers — AES-GCM Ver-/Entschlüsselung
@noble/hashes  — PBKDF2 für PIN-Backup
```

### Dateien

| Datei | Aufgabe |
|---|---|
| `lib/crypto/e2e.ts` | Krypto-Primitiven: Keypair, ECDH, AES-GCM, PBKDF2 |
| `lib/crypto/keyStore.ts` | Persistenz via `expo-secure-store` (Keychain/Keystore) |
| `lib/crypto/e2eContext.tsx` | React-Kontext: `hasKey`, `isChecking`, `recheckKey` |
| `app/e2e-setup.tsx` | Ersteinrichtungs-Screen (Neuer Key / Backup wiederherstellen) |

---

## Schlüssel-Typen

### Eigener Private Key
- 32 Bytes (raw P-256 Scalar)
- Intern: base64-kodiert in `expo-secure-store` unter `e2e_private_key`
- **Verlässt das Gerät nie im Klartext**

### Eigener Public Key
- 65 Bytes (unkomprimierter P-256 Punkt, `04 || x || y`)
- Gespeichert: base64 in `expo-secure-store` unter `e2e_public_key`
- Extern: SPKI-Format (91 Bytes), hochgeladen via `PUT /api/users/me/public-key`

### SPKI / PKCS8 Kompatibilität

Die Web-App nutzt die Web Crypto API, die Keys in SPKI (Public) und PKCS8 (Private) Format speichert. Die Mobile App baut diese Formate manuell aus den raw Bytes auf, damit Backups und Public Keys austauschbar sind:

```
Public Key (SPKI, 91 Bytes):
  26-Byte Header + 65-Byte uncompressed P-256 Point

Private Key Backup (PKCS8, 67 Bytes):
  35-Byte Header + 32-Byte raw P-256 scalar
```

---

## Verschlüsselungsflüsse

### DM-Nachrichten

```
Sender                    Backend              Empfänger
  │                         │                     │
  ├─ Eigener PrivKey ────────┤                     │
  ├─ Partner PubKey (API) ───┤                     │
  ├─ ECDH → SharedKey        │                     │
  ├─ AES-GCM encrypt ────────┼─ { ciphertext, iv } ┤
  │                          │                     ├─ Eigener PrivKey
  │                          │                     ├─ Sender PubKey (API)
  │                          │                     ├─ ECDH → SharedKey
  │                          │                     └─ AES-GCM decrypt
```

### Gruppen-Nachrichten

```
Distributor (Gruppe erstellt)           Mitglied
  │                                       │
  ├─ generateGroupKey() → GroupKey         │
  ├─ Für jedes Mitglied:                   │
  │    ECDH(Distributor.priv, Member.pub) │
  │    AES-GCM(GroupKey, SharedKey)       │
  │    → encryptedGroupKey                │
  ├─ PUT /conversations/:id/group-keys ───┤
  │                                       │
  │                                       ├─ GET encryptedGroupKey (aus Conv-Liste)
  │                                       ├─ GET Distributor PubKey (API)
  │                                       ├─ ECDH(Member.priv, Distributor.pub)
  │                                       ├─ AES-GCM decrypt → GroupKey
  │                                       └─ AES-GCM decrypt Nachrichten
```

---

## Key-Backup (PIN-Schutz)

```
Backup erstellen:
  1. PBKDF2(PIN, RandomSalt, 600k iter) → PinKey
  2. AES-GCM(PrivateKey als PKCS8, PinKey) → { ciphertext, iv }
  3. PUT /api/users/me/key-backup → { encryptedPrivateKey, iv, salt }

Backup wiederherstellen:
  1. GET /api/users/me/key-backup → { encryptedPrivateKey, iv, salt }
  2. PBKDF2(PIN, salt, 600k iter) → PinKey
  3. AES-GCM decrypt(ciphertext, iv, PinKey) → PKCS8
  4. Trim PKCS8 Header → raw 32-Byte PrivateKey
  5. P-256 getPublicKey(PrivateKey) → PublicKey
  6. PUT /api/users/me/public-key → PublicKey (SPKI)
```

---

## Key-Rotation (historische Keys)

Beim Wechsel des Schlüssels (z.B. neue Einrichtung) wird der alte Key in der History gespeichert (`e2e_priv_history`, max. 5 Einträge). Dadurch können ältere Nachrichten, die mit einem früheren Key verschlüsselt wurden, weiterhin entschlüsselt werden.

---

## API-Endpoints

| Methode | Endpoint | Zweck |
|---|---|---|
| `PUT` | `/api/users/me/public-key` | Eigenen Public Key hochladen |
| `GET` | `/api/users/:id/public-key` | Public Key eines anderen Users abrufen |
| `GET` | `/api/users/me/key-backup` | Backup-Status und verschlüsseltes Backup laden |
| `PUT` | `/api/users/me/key-backup` | PIN-verschlüsseltes Backup hochladen |
| `PUT` | `/api/messenger/conversations/:id/group-keys` | Gruppen-Keys verteilen |

---

## Bekannte Einschränkungen

| Einschränkung | Begründung |
|---|---|
| PBKDF2 blockiert UI ~2-4 Sek. | JavaScript Single-Thread — kein Worker in RN ohne native Modul |
| Gruppe erstellen nur in Web-App | Schlüsselverteilung bei Erstellung ist komplex — Mobile = Empfänger |
| DM-Verschlüsselung setzt Public Key voraus | Wenn Gesprächspartner keinen Key hat, wird unverschlüsselt gesendet |
