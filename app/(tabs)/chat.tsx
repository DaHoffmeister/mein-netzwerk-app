// app/(tabs)/chat.tsx
// Konversationsliste — Signal-Stil, getrennt in DMs und Gruppen

import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../lib/ThemeContext';
import { messenger, usersApi } from '../../lib/api';
import { getUser } from '../../lib/auth';

// ── Typen ────────────────────────────────────────────────────────

type LastMessage = {
  text: string | null;
  type: string;
  senderName: string;
  createdAt: string;
};

type Participant = { id: number; username: string };

export type Conversation = {
  id: number;
  isGroup: boolean;
  name: string;
  imageUrl: string | null;
  lastMessage: LastMessage | null;
  lastReadAt: string | null;
  isMuted: boolean;
  updatedAt: string;
  participants?: Participant[];
  encryptedGroupKey?: string | null;
  groupKeyDistributorId?: number | null;
};

// ── Hilfsfunktionen ──────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (isToday) return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  if (d.getFullYear() === now.getFullYear())
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

function isUnread(conv: Conversation): boolean {
  if (!conv.lastMessage) return false;
  if (!conv.lastReadAt) return true;
  return new Date(conv.lastMessage.createdAt) > new Date(conv.lastReadAt);
}

function getLastMessagePreview(msg: LastMessage | null): string {
  if (!msg) return 'Noch keine Nachrichten';
  if (msg.type === 'IMAGE') return '📷 Bild';
  if (msg.type === 'FILE') return '📎 Datei';
  if (!msg.text) return '🔒 Verschlüsselte Nachricht';
  return `${msg.senderName}: ${msg.text}`;
}

// ── Avatar ───────────────────────────────────────────────────────

function Avatar({ name, size }: { name: string; size: number }) {
  const hue = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: `hsl(${hue}, 45%, 38%)` }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>{getInitials(name)}</Text>
    </View>
  );
}

// ── Konversations-Zeile ──────────────────────────────────────────

function ConvRow({ conv, onPress }: { conv: Conversation; onPress: () => void }) {
  const { theme } = useTheme();
  const unread = isUnread(conv) && !conv.isMuted;
  const preview = getLastMessagePreview(conv.lastMessage);
  const time = conv.lastMessage?.createdAt ? formatTime(conv.lastMessage.createdAt) : '';
  const isEncrypted = !!(conv.isGroup && conv.encryptedGroupKey);

  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: theme.panel }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Avatar name={conv.name} size={52} />

      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={[styles.rowName, { color: theme.text }, unread && styles.rowNameBold]} numberOfLines={1}>
            {isEncrypted ? '🔒 ' : ''}{conv.name}
          </Text>
          <Text style={[styles.rowTime, { color: unread ? theme.brand : theme.textDim }]}>{time}</Text>
        </View>
        <View style={styles.rowBottom}>
          <Text style={[styles.rowPreview, { color: theme.textDim }]} numberOfLines={1}>{preview}</Text>
          {unread && <View style={[styles.unreadDot, { backgroundColor: theme.brand }]} />}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Hauptscreen ──────────────────────────────────────────────────

type Tab = 'dm' | 'group';

export default function ChatScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('dm');
  const [myUserId, setMyUserId] = useState<number | null>(null);

  // User-Picker für neuen DM
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerUsers, setPickerUsers] = useState<{ id: number; username: string }[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerCreating, setPickerCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const [data, userRaw] = await Promise.all([
        messenger.conversations(),
        getUser(),
      ]);
      setConversations(data);
      const u = userRaw as { id: number } | null;
      if (u?.id) setMyUserId(u.id);
    } catch (err) {
      console.error('Fehler beim Laden der Chats:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function openPicker() {
    setPickerVisible(true);
    setPickerLoading(true);
    try {
      const all = await usersApi.all();
      setPickerUsers(all.filter((u) => u.id !== myUserId));
    } catch { setPickerUsers([]); }
    finally { setPickerLoading(false); }
  }

  async function openDMWith(userId: number, username: string) {
    setPickerCreating(true);
    try {
      const conv = await messenger.createDM(userId);
      setPickerVisible(false);
      router.push({
        pathname: '/chat/[id]',
        params: {
          id: conv.id,
          name: username,
          isGroup: '0',
          partnerId: String(userId),
          encryptedGroupKey: '',
          groupKeyDistributorId: '',
        },
      });
    } catch (err) {
      console.error('DM erstellen fehlgeschlagen:', err);
    } finally {
      setPickerCreating(false);
    }
  }

  function openConversation(conv: Conversation) {
    // Für DMs: Partner-ID herausfinden (nicht ich selbst)
    const partnerId = !conv.isGroup && conv.participants
      ? (conv.participants.find((p) => p.id !== myUserId)?.id ?? null)
      : null;

    router.push({
      pathname: '/chat/[id]',
      params: {
        id: conv.id,
        name: conv.name,
        isGroup: conv.isGroup ? '1' : '0',
        partnerId: partnerId ? String(partnerId) : '',
        encryptedGroupKey: conv.encryptedGroupKey ?? '',
        groupKeyDistributorId: conv.groupKeyDistributorId ? String(conv.groupKeyDistributorId) : '',
      },
    });
  }

  const dms    = conversations.filter((c) => !c.isGroup);
  const groups = conversations.filter((c) => c.isGroup);
  const visible = activeTab === 'dm' ? dms : groups;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { backgroundColor: theme.panel, borderBottomColor: theme.muted }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Nachrichten</Text>
        <TouchableOpacity onPress={openPicker} hitSlop={12}>
          <Text style={[styles.newChatBtn, { color: theme.brand }]}>＋</Text>
        </TouchableOpacity>
      </View>

      {/* User-Picker Modal */}
      <Modal visible={pickerVisible} animationType="slide" transparent onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: theme.panel }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Neue Nachricht</Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <Text style={[styles.modalClose, { color: theme.textDim }]}>✕</Text>
              </TouchableOpacity>
            </View>
            {pickerLoading
              ? <ActivityIndicator color={theme.brand} style={{ marginTop: 24, marginBottom: 24 }} />
              : <FlatList
                  data={pickerUsers}
                  keyExtractor={(u) => String(u.id)}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.pickerRow, { borderBottomColor: theme.muted }]}
                      onPress={() => openDMWith(item.id, item.username)}
                      disabled={pickerCreating}
                    >
                      <Text style={[styles.pickerName, { color: theme.text }]}>{item.username}</Text>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    <Text style={[styles.pickerEmpty, { color: theme.textDim }]}>Keine User gefunden</Text>
                  }
                />
            }
          </View>
        </View>
      </Modal>

      <View style={[styles.tabBar, { backgroundColor: theme.panel, borderBottomColor: theme.muted }]}>
        {(['dm', 'group'] as Tab[]).map((tab) => {
          const label  = tab === 'dm' ? 'Direktnachrichten' : 'Gruppen';
          const count  = tab === 'dm' ? dms.length : groups.length;
          const active = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tabBtn, active && { borderBottomColor: theme.brand, borderBottomWidth: 2 }]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabLabel, { color: active ? theme.brand : theme.textDim }]}>{label}</Text>
              {count > 0 && (
                <View style={[styles.tabBadge, { backgroundColor: active ? theme.brand : theme.muted }]}>
                  <Text style={[styles.tabBadgeText, { color: active ? theme.bg : theme.textDim }]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color={theme.brand} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <ConvRow conv={item} onPress={() => openConversation(item)} />
          )}
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: theme.muted }]} />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: theme.textDim }]}>
                {activeTab === 'dm' ? 'Keine Direktnachrichten' : 'Keine Gruppen'}
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={theme.brand}
            />
          }
          style={{ flex: 1 }}
        />
      )}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 54, paddingBottom: 12, paddingHorizontal: 18, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 26, fontWeight: '700' },
  newChatBtn: { fontSize: 28, fontWeight: '300', lineHeight: 34 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, paddingBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalClose: { fontSize: 18 },
  pickerRow: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  pickerName: { fontSize: 16 },
  pickerEmpty: { textAlign: 'center', marginTop: 20, fontSize: 14 },
  tabBar: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  tabLabel: { fontSize: 13, fontWeight: '600' },
  tabBadge: { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1, minWidth: 20, alignItems: 'center' },
  tabBadgeText: { fontSize: 11, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
  avatar: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontWeight: '700', color: '#fff' },
  rowBody: { flex: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  rowName: { fontSize: 15, flex: 1, marginRight: 8 },
  rowNameBold: { fontWeight: '700' },
  rowTime: { fontSize: 12, flexShrink: 0 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowPreview: { fontSize: 13, flex: 1, marginRight: 8 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 80 },
  empty: { flex: 1, alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 15 },
});
