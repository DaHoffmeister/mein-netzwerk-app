// app/chat/[id].tsx
// Einzelner Chat — Signal-Stil mit E2E-Entschlüsselung.
// Gruppen: AES-GCM mit geteiltem Gruppen-Key (wie Web-App).
// DMs: AES-GCM mit ECDH-Shared-Key zwischen den zwei Teilnehmern.

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, SafeAreaView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../lib/ThemeContext';
import { messenger, e2eApi } from '../../lib/api';
import { getToken, getUser } from '../../lib/auth';
import {
  importPublicKey, importPrivateKeyRaw,
  deriveSharedKey, unwrapGroupKey, importGroupKey,
  decryptMessage, encryptMessage,
} from '../../lib/crypto/e2e';
import {
  loadPrivateKey, loadPrivateKeyHistory,
  savePartnerPublicKey, loadPartnerPublicKey,
} from '../../lib/crypto/keyStore';

// ── Typen ────────────────────────────────────────────────────────

type Message = {
  id: number;
  text: string | null;
  type: string;
  senderId: number;
  senderName: string | undefined;
  createdAt: string;
  encrypted: boolean;
  ciphertext: string | null;
  iv: string | null;
  deletedAt: string | null;
};

type StoredUser = { id: number; username: string };

// ── Hilfsfunktionen ──────────────────────────────────────────────

function formatBubbleTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function getInitials(name: string | undefined): string {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

function getAvatarColor(name: string | undefined): string {
  if (!name) return 'hsl(0, 0%, 40%)';
  const hue = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return `hsl(${hue}, 45%, 38%)`;
}

function getMessageText(msg: Message): string {
  if (msg.deletedAt) return 'Nachricht gelöscht';
  if (msg.type === 'IMAGE') return '📷 Bild';
  if (msg.type === 'FILE') return '📎 Datei';
  return msg.text ?? '🔒 Verschlüsselte Nachricht';
}

// ── Nachrichtenblase ─────────────────────────────────────────────

function Bubble({ msg, isOwn, showSender }: { msg: Message; isOwn: boolean; showSender: boolean }) {
  const { theme } = useTheme();
  const text      = getMessageText(msg);
  const isDeleted = !!msg.deletedAt;
  const isLocked  = !msg.deletedAt && msg.encrypted && msg.text === null;

  return (
    <View style={[styles.bubbleWrapper, isOwn ? styles.bubbleWrapperOwn : styles.bubbleWrapperOther]}>
      {!isOwn && (
        <View style={[styles.bubbleAvatar, { backgroundColor: getAvatarColor(msg.senderName) }]}>
          <Text style={styles.bubbleAvatarText}>{getInitials(msg.senderName)}</Text>
        </View>
      )}

      <View style={styles.bubbleCol}>
        {!isOwn && showSender && (
          <Text style={[styles.bubbleSender, { color: theme.brand }]}>{msg.senderName}</Text>
        )}

        <View style={[
          styles.bubble,
          isOwn
            ? { backgroundColor: theme.brand }
            : { backgroundColor: theme.panel, borderColor: theme.muted, borderWidth: StyleSheet.hairlineWidth },
          (isDeleted || isLocked) && { opacity: 0.5 },
        ]}>
          <Text style={[
            styles.bubbleText,
            { color: isOwn ? theme.bg : theme.text },
            (isDeleted || isLocked) && { fontStyle: 'italic' },
          ]}>
            {text}
          </Text>
        </View>

        <Text style={[styles.bubbleTime, { color: theme.textDim }]}>
          {formatBubbleTime(msg.createdAt)}
        </Text>
      </View>
    </View>
  );
}

// ── Entschlüsselungs-Hilfsfunktionen ─────────────────────────────

async function tryDecryptWithKey(msg: Message, key: Uint8Array): Promise<string | null> {
  if (!msg.ciphertext || !msg.iv) return null;
  try {
    return decryptMessage(msg.ciphertext, msg.iv, key);
  } catch {
    return null;
  }
}

async function decryptMessages(
  msgs: Message[],
  primaryKey: Uint8Array | null,
  fallbackKeys: Uint8Array[],
): Promise<Message[]> {
  return Promise.all(msgs.map(async (msg) => {
    if (!msg.encrypted || !msg.ciphertext || !msg.iv) return msg;

    const keys = [primaryKey, ...fallbackKeys].filter(Boolean) as Uint8Array[];
    for (const key of keys) {
      const plaintext = await tryDecryptWithKey(msg, key);
      if (plaintext !== null) return { ...msg, text: plaintext };
    }

    return { ...msg, text: null }; // 🔒 bleibt gesetzt wenn alle Keys scheitern
  }));
}

// ── Hauptscreen ──────────────────────────────────────────────────

export default function ChatDetailScreen() {
  const { theme }   = useTheme();
  const router      = useRouter();
  const insets      = useSafeAreaInsets();
  const params      = useLocalSearchParams<{
    id: string;
    name: string;
    isGroup: string;
    partnerId: string;
    encryptedGroupKey: string;
    groupKeyDistributorId: string;
  }>();

  const convId     = Number(params.id);
  const convName   = params.name ?? '';
  const isGroup    = params.isGroup === '1';
  const partnerId  = params.partnerId ? Number(params.partnerId) : null;
  const encGroupKey = params.encryptedGroupKey || null;
  const groupKeyDistId = params.groupKeyDistributorId ? Number(params.groupKeyDistributorId) : null;

  const [messages,  setMessages]  = useState<Message[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending,   setSending]   = useState(false);
  const [myUser,    setMyUser]    = useState<StoredUser | null>(null);
  const [e2eReady,  setE2eReady]  = useState(false);
  const [isEncrypted, setIsEncrypted] = useState(false);

  const activeKeyRef    = useRef<Uint8Array | null>(null);  // primärer Entschlüsselungs-Key
  const fallbackKeysRef = useRef<Uint8Array[]>([]);          // historische Keys
  const wsRef           = useRef<WebSocket | null>(null);
  const listRef         = useRef<FlatList>(null);

  // ── E2E Key ableiten ─────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function initE2E() {
      const privKeyB64 = await loadPrivateKey();
      if (!privKeyB64) { setE2eReady(true); return; }
      const myPrivKey = importPrivateKeyRaw(privKeyB64);

      const privHistB64 = await loadPrivateKeyHistory();
      const histKeys = privHistB64
        .map((b) => { try { return importPrivateKeyRaw(b); } catch { return null; } })
        .filter(Boolean) as Uint8Array[];

      try {
        if (isGroup && encGroupKey && groupKeyDistId) {
          // ── Gruppen-Key entschlüsseln ──────────────────────────────────
          const { publicKey: distPubB64 } = await e2eApi.getPublicKey(groupKeyDistId);
          if (!distPubB64) { if (!cancelled) setE2eReady(true); return; }
          const distPubKey = importPublicKey(distPubB64);
          const sharedKey  = deriveSharedKey(myPrivKey, distPubKey);
          let groupKey: Uint8Array | null = null;
          try { groupKey = unwrapGroupKey(encGroupKey, sharedKey); } catch { /* versuche historische */ }

          const histGroupKeys: Uint8Array[] = [];
          for (const histPriv of histKeys) {
            try {
              const histShared = deriveSharedKey(histPriv, distPubKey);
              histGroupKeys.push(unwrapGroupKey(encGroupKey, histShared));
            } catch { /* skip */ }
          }

          if (!cancelled) {
            activeKeyRef.current    = groupKey ?? histGroupKeys[0] ?? null;
            fallbackKeysRef.current = histGroupKeys;
            if (activeKeyRef.current) setIsEncrypted(true);
          }
        } else if (!isGroup && partnerId) {
          // ── DM: ECDH-Shared-Key ableiten ──────────────────────────────
          let partnerPubB64 = await loadPartnerPublicKey(partnerId);
          if (!partnerPubB64) {
            const res = await e2eApi.getPublicKey(partnerId);
            partnerPubB64 = res.publicKey ?? null;
            if (partnerPubB64) await savePartnerPublicKey(partnerId, partnerPubB64);
          }
          if (!partnerPubB64) {
            // Partner hat noch keinen E2E-Key → Chat läuft unverschlüsselt
            if (!cancelled) setE2eReady(true);
            return;
          }
          const partnerPub = importPublicKey(partnerPubB64);
          const sharedKey  = deriveSharedKey(myPrivKey, partnerPub);

          const histDMKeys: Uint8Array[] = histKeys.map((hk) => deriveSharedKey(hk, partnerPub));

          if (!cancelled) {
            activeKeyRef.current    = sharedKey;
            fallbackKeysRef.current = histDMKeys;
            setIsEncrypted(true);
          }
        }
      } catch (err) {
        console.warn('[E2E] Key-Ableitung fehlgeschlagen:', err);
      }

      if (!cancelled) setE2eReady(true);
    }

    initE2E();
    return () => { cancelled = true; };
  }, [convId, isGroup, encGroupKey, groupKeyDistId, partnerId]);

  // ── Nachrichten laden ─────────────────────────────────────────

  useEffect(() => {
    if (!e2eReady) return;
    let cancelled = false;

    async function init() {
      try {
        const [user, resp] = await Promise.all([
          getUser() as Promise<StoredUser | null>,
          messenger.messages(convId),
        ]);
        if (cancelled) return;
        setMyUser(user);

        const raw: Message[] = resp.messages ?? resp;
        const decrypted = await decryptMessages(raw, activeKeyRef.current, fallbackKeysRef.current);
        setMessages(decrypted);
        await messenger.markRead(convId).catch(() => {});
      } catch (err) {
        console.error('Fehler beim Laden der Nachrichten:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, [convId, e2eReady]);

  // ── WebSocket ─────────────────────────────────────────────────

  useEffect(() => {
    if (!e2eReady) return;
    let ws: WebSocket;

    async function connect() {
      const token = await getToken();
      if (!token) return;

      ws = new WebSocket(`wss://net.assozrpg.de/ws?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type !== 'messenger-message') return;
          if (data.message?.conversationId !== convId) return;

          let msg: Message = data.message;

          if (msg.encrypted && msg.ciphertext && msg.iv) {
            const keys = [activeKeyRef.current, ...fallbackKeysRef.current].filter(Boolean) as Uint8Array[];
            for (const key of keys) {
              const pt = await tryDecryptWithKey(msg, key);
              if (pt !== null) { msg = { ...msg, text: pt }; break; }
            }
          }

          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [msg, ...prev];
          });
          messenger.markRead(convId).catch(() => {});
        } catch { /* ignore parse errors */ }
      };

      ws.onerror = (e) => console.warn('[WS] Fehler:', e);
    }

    connect();
    return () => { wsRef.current = null; ws?.close(); };
  }, [convId, e2eReady]);

  // ── Nachricht senden ──────────────────────────────────────────

  async function handleSend() {
    const text = inputText.trim();
    if (!text || sending) return;
    setInputText('');
    setSending(true);

    try {
      const ws = wsRef.current;
      const wsOpen = ws?.readyState === WebSocket.OPEN;

      if (isEncrypted && activeKeyRef.current) {
        // Verschlüsselt senden
        const { ciphertext, iv } = encryptMessage(text, activeKeyRef.current);
        const payload = { type: 'messenger-message', conversationId: convId, ciphertext, iv };

        if (wsOpen) {
          ws!.send(JSON.stringify(payload));
        } else {
          const saved = await messenger.send(convId, { ciphertext, iv });
          setMessages((prev) => [{ ...saved, text }, ...prev]);
        }
      } else {
        // Unverschlüsselt senden
        if (wsOpen) {
          ws!.send(JSON.stringify({ type: 'messenger-message', conversationId: convId, text }));
        } else {
          const saved = await messenger.send(convId, { text });
          setMessages((prev) => [saved, ...prev]);
        }
      }
    } catch (err) {
      console.error('[Chat] Senden fehlgeschlagen:', err);
      setInputText(inputText); // Text zurückschreiben
    } finally {
      setSending(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.panel, borderBottomColor: theme.muted }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Text style={[styles.backText, { color: theme.brand }]}>‹</Text>
        </TouchableOpacity>

        <View style={[styles.headerAvatar, { backgroundColor: getAvatarColor(convName) }]}>
          <Text style={styles.headerAvatarText}>{getInitials(convName)}</Text>
        </View>

        <Text style={[styles.headerName, { color: theme.text }]} numberOfLines={1}>
          {convName}
        </Text>

        {isEncrypted && (
          <Text style={{ color: theme.brand, fontSize: 14, marginLeft: 4 }}>🔒</Text>
        )}
      </View>

      {/* Verschlüsselungs-Banner */}
      {isEncrypted && (
        <View style={[styles.encBanner, { backgroundColor: theme.panel, borderBottomColor: theme.muted }]}>
          <Text style={[styles.encBannerText, { color: theme.brand }]}>Ende-zu-Ende verschlüsselt</Text>
        </View>
      )}

      {/* Nachrichten */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <ActivityIndicator style={{ flex: 1 }} color={theme.brand} />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item, index }) => {
              const isOwn      = item.senderId === myUser?.id;
              const prevMsg    = messages[index + 1];
              const showSender = !isOwn && item.senderName !== prevMsg?.senderName;
              return <Bubble msg={item} isOwn={isOwn} showSender={showSender} />;
            }}
            inverted
            contentContainerStyle={styles.messageList}
            style={{ flex: 1, backgroundColor: theme.bg }}
          />
        )}

        {/* Input-Leiste */}
        <View style={[styles.inputBar, { backgroundColor: theme.panel, borderTopColor: theme.muted, paddingBottom: insets.bottom + 8 }]}>
          <TextInput
            style={[styles.input, { backgroundColor: theme.bg, color: theme.text, borderColor: theme.muted }]}
            placeholder={isEncrypted ? '🔒 Nachricht verschlüsseln…' : 'Nachricht…'}
            placeholderTextColor={theme.textDim}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={4000}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: theme.brand }, (!inputText.trim() || sending) && { opacity: 0.4 }]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
          >
            <Text style={[styles.sendBtnText, { color: theme.bg }]}>▶</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 0 : 12,
    paddingBottom: 10,
    paddingHorizontal: 12,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { paddingRight: 4 },
  backText: { fontSize: 32, lineHeight: 36, fontWeight: '300' },
  headerAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  headerAvatarText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  headerName: { fontSize: 17, fontWeight: '600', flex: 1 },

  encBanner: { paddingVertical: 4, alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  encBannerText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.4 },

  messageList: { paddingHorizontal: 12, paddingVertical: 8 },

  bubbleWrapper: { flexDirection: 'row', marginVertical: 2, alignItems: 'flex-end', gap: 6 },
  bubbleWrapperOwn: { justifyContent: 'flex-end' },
  bubbleWrapperOther: { justifyContent: 'flex-start' },
  bubbleAvatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: 16 },
  bubbleAvatarText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  bubbleCol: { maxWidth: '75%' },
  bubbleSender: { fontSize: 11, fontWeight: '700', marginBottom: 2, marginLeft: 4 },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  bubbleTime: { fontSize: 10, marginTop: 2, marginHorizontal: 4 },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 8, fontSize: 15, maxHeight: 120 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sendBtnText: { fontSize: 16, fontWeight: '700', marginLeft: 2 },
});
