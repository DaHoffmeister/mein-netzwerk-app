// app/(tabs)/index.tsx
// Home-Screen — Join Session verwalten, Konsum zählen, Benachrichtigungen senden

import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Modal, TextInput, Switch, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../lib/api';
import { getToken } from '../../lib/auth';
import { useTheme } from '../../lib/ThemeContext';

// ── Typen ────────────────────────────────────────────────────────

type Participant = {
  userId: number;
  username: string;
  avatarUrl?: string;
  notificationsOn: boolean;
  Bier: number; Wein: number; Shot: number;
  Cocktail: number; Joint: number; Line: number;
};

type Session = {
  id: number;
  name: string;
  code: string;
  createdById: number;
  participants: { user: { id: number; username: string } }[];
};

// ── Konstanten ───────────────────────────────────────────────────

const ITEMS = [
  { key: 'Bier',     emoji: '🍺', category: 'alcohol' },
  { key: 'Wein',     emoji: '🍷', category: 'alcohol' },
  { key: 'Shot',     emoji: '🥃', category: 'alcohol' },
  { key: 'Cocktail', emoji: '🍹', category: 'alcohol' },
  { key: 'Joint',    emoji: '🥦', category: 'drug' },
  { key: 'Line',     emoji: '❄️', category: 'drug' },
];

const NOTIFY_TYPES = [
  { key: 'essen', emoji: '🍕', label: 'Essen da!' },
  { key: 'joint', emoji: '🥦', label: 'Joint läuft!' },
  { key: 'line',  emoji: '❄️', label: 'Lines fertig!' },
];

// ── Hauptkomponente ──────────────────────────────────────────────

export default function HomeScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [session, setSession] = useState<Session | null>(null);
  const [stats, setStats] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [showConsume, setShowConsume] = useState(false);
  const [selectedItem, setSelectedItem] = useState<typeof ITEMS[0] | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Session erstellen
  const [sessionName, setSessionName] = useState('');
  const [allUsers, setAllUsers] = useState<{ id: number; username: string }[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

  // Konsum teilen
  const [shareUserIds, setShareUserIds] = useState<number[]>([]);

  // Eigene Notifications
  const [notificationsOn, setNotificationsOn] = useState(true);

  // ── Daten laden ─────────────────────────────────────────────────

  const loadSession = useCallback(async () => {
    if (!(await getToken())) { setLoading(false); return; }
    try {
      const res = await api.get('/counter/sessions/active');
      setSession(res.data);
      if (res.data) {
        const statsRes = await api.get(`/counter/sessions/${res.data.id}/stats`);
        setStats(statsRes.data);
        const me = statsRes.data.find((p: Participant) => p.notificationsOn !== undefined);
        if (me) setNotificationsOn(me.notificationsOn);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Session:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadSession(); }, [loadSession]));

  async function loadUsers() {
    try {
      const res = await api.get('/users');
      setAllUsers(res.data);
    } catch {}
  }

  // ── Session erstellen ────────────────────────────────────────────

  async function handleCreateSession() {
    if (!sessionName.trim()) {
      setErrorMsg('Bitte einen Namen eingeben.');
      return;
    }
    setErrorMsg('');
    try {
      const res = await api.post('/counter/sessions', {
        name: sessionName.trim(),
        participantIds: selectedUserIds,
      });
      setSession(res.data);
      setShowCreate(false);
      setSessionName('');
      setSelectedUserIds([]);
      loadSession();
    } catch {
      setErrorMsg('Session konnte nicht erstellt werden.');
    }
  }

  // ── Session beenden ──────────────────────────────────────────────

  function handleEndSession() {
    setConfirm({
      title: 'Session beenden',
      message: 'Willst du den Abend wirklich beenden?',
      onConfirm: async () => {
        await api.post(`/counter/sessions/${session!.id}/end`);
        setSession(null);
        setStats([]);
        setConfirm(null);
      },
    });
  }

  // ── Konsum eintragen ─────────────────────────────────────────────

  function openConsumeModal(item: typeof ITEMS[0]) {
    setSelectedItem(item);
    setShareUserIds([]);
    setShowConsume(true);
  }

  async function handleConsume(forSelf: boolean) {
    if (!session || !selectedItem) return;
    const userIds = forSelf ? undefined : shareUserIds;
    try {
      await api.post(`/counter/sessions/${session.id}/consume`, {
        item: selectedItem.key,
        userIds,
      });
      setShowConsume(false);
      loadSession();
    } catch {
      setErrorMsg('Konsum konnte nicht eingetragen werden.');
    }
  }

  // ── Benachrichtigung senden ──────────────────────────────────────

  async function handleNotify(type: string) {
    if (!session) return;
    try {
      await api.post(`/counter/sessions/${session.id}/notify`, { type });
    } catch {
      setErrorMsg('Benachrichtigung konnte nicht gesendet werden.');
    }
  }

  // ── Notifications togglen ────────────────────────────────────────

  async function handleToggleNotifications(value: boolean) {
    if (!session) return;
    setNotificationsOn(value);
    await api.patch(`/counter/sessions/${session.id}/notifications`, { on: value });
  }

  // ── Render ───────────────────────────────────────────────────────

  if (loading) {
    return <ActivityIndicator style={{ flex: 1 }} color={theme.brand} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={[styles.header, { backgroundColor: theme.panel, borderBottomColor: theme.muted, paddingTop: insets.top + 8 }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Home</Text>
      </View>
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadSession(); }} tintColor={theme.brand} />}
    >
      {/* ── Kein aktiver Abend ── */}
      {!session && (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: theme.textDim }]}>Kein aktiver Abend</Text>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.brand }]}
            onPress={() => { loadUsers(); setShowCreate(true); }}
          >
            <Text style={[styles.primaryButtonText, { color: theme.bg }]}>🎉 Abend starten</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Aktiver Abend ── */}
      {session && (
        <>
          {/* Header */}
          <View style={[styles.sessionHeader, { backgroundColor: theme.panel }]}>
            <Text style={[styles.sessionName, { color: theme.brand }]}>{session.name}</Text>
            <Text style={[styles.sessionCode, { color: theme.textDim }]}>Code: {session.code}</Text>
            <TouchableOpacity onPress={handleEndSession}>
              <Text style={[styles.endButton, { color: theme.danger }]}>Beenden</Text>
            </TouchableOpacity>
          </View>

          {/* Alkohol-Buttons */}
          <Text style={[styles.sectionTitle, { color: theme.textDim }]}>ALKOHOL</Text>
          <View style={styles.buttonGrid}>
            {ITEMS.filter(i => i.category === 'alcohol').map(item => (
              <TouchableOpacity
                key={item.key}
                style={[styles.counterButton, { backgroundColor: theme.brand }]}
                onPress={() => openConsumeModal(item)}
              >
                <Text style={styles.counterEmoji}>{item.emoji}</Text>
                <Text style={[styles.counterLabel, { color: theme.bg }]}>{item.key}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Leckerlies-Buttons */}
          <Text style={[styles.sectionTitle, { color: theme.textDim }]}>LECKERLIES</Text>
          <View style={styles.buttonGrid}>
            {ITEMS.filter(i => i.category === 'drug').map(item => (
              <TouchableOpacity
                key={item.key}
                style={[styles.counterButton, { backgroundColor: theme.accent }]}
                onPress={() => openConsumeModal(item)}
              >
                <Text style={styles.counterEmoji}>{item.emoji}</Text>
                <Text style={[styles.counterLabel, { color: theme.text }]}>{item.key}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Benachrichtigungs-Buttons */}
          <Text style={[styles.sectionTitle, { color: theme.textDim }]}>BENACHRICHTIGEN</Text>
          <View style={styles.notifyRow}>
            {NOTIFY_TYPES.map(n => (
              <TouchableOpacity
                key={n.key}
                style={[styles.notifyButton, { backgroundColor: theme.panel, borderColor: theme.muted }]}
                onPress={() => handleNotify(n.key)}
              >
                <Text style={styles.notifyEmoji}>{n.emoji}</Text>
                <Text style={[styles.notifyLabel, { color: theme.textDim }]}>{n.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Notifications Toggle */}
          <View style={[styles.toggleRow, { backgroundColor: theme.panel }]}>
            <Text style={[styles.toggleLabel, { color: theme.text }]}>🔔 Benachrichtigungen</Text>
            <Switch
              value={notificationsOn}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: theme.muted, true: theme.brand }}
              thumbColor={theme.panel}
            />
          </View>

          {/* Stats-Tabelle — nur Spalten mit mind. einem Eintrag */}
          <Text style={[styles.sectionTitle, { color: theme.textDim }]}>ÜBERSICHT</Text>
          {(() => {
            const activeItems = ITEMS.filter(item =>
              stats.some(p => (p[item.key as keyof Participant] as number) > 0)
            );
            if (activeItems.length === 0) return (
              <Text style={[{ color: theme.textDim, marginLeft: 16, marginBottom: 12 }]}>Noch nichts konsumiert.</Text>
            );
            return (
              <ScrollView horizontal>
                <View>
                  <View style={styles.tableRow}>
                    <Text style={[styles.tableCell, styles.tableCellName, styles.tableHeader, { color: theme.textDim }]}>Name</Text>
                    {activeItems.map(i => (
                      <Text key={i.key} style={[styles.tableCell, styles.tableHeader, { color: theme.textDim }]}>{i.emoji}</Text>
                    ))}
                  </View>
                  {stats.map((p, idx) => (
                    <View key={p.userId} style={[styles.tableRow, idx % 2 === 0 && { backgroundColor: theme.panel }]}>
                      <Text style={[styles.tableCell, styles.tableCellName, { color: theme.text }]}>{p.username}</Text>
                      {activeItems.map(i => (
                        <Text key={i.key} style={[styles.tableCell, { color: theme.text }]}>{p[i.key as keyof Participant] as number}</Text>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
            );
          })()}
        </>
      )}

      {/* ── Modal: Session erstellen ── */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.panel }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Abend starten</Text>
            <TextInput
              style={[styles.input, { borderColor: theme.muted, color: theme.text, backgroundColor: theme.bg }]}
              placeholder="Name des Abends"
              placeholderTextColor={theme.textDim}
              value={sessionName}
              onChangeText={setSessionName}
            />
            {errorMsg ? <Text style={{ color: theme.danger, marginBottom: 8 }}>{errorMsg}</Text> : null}
            <Text style={[styles.modalSubtitle, { color: theme.textDim }]}>Teilnehmer auswählen:</Text>
            <ScrollView style={{ maxHeight: 200 }}>
              {allUsers.map(u => (
                <TouchableOpacity
                  key={u.id}
                  style={[styles.userRow, { borderBottomColor: theme.muted }]}
                  onPress={() => setSelectedUserIds(ids =>
                    ids.includes(u.id) ? ids.filter(id => id !== u.id) : [...ids, u.id]
                  )}
                >
                  <Text style={[styles.checkbox, { color: theme.brand }]}>{selectedUserIds.includes(u.id) ? '☑' : '☐'}</Text>
                  <Text style={[styles.userName, { color: theme.text }]}>{u.username}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.brand }]} onPress={handleCreateSession}>
              <Text style={[styles.primaryButtonText, { color: theme.bg }]}>Erstellen</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <Text style={[styles.cancelText, { color: theme.textDim }]}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Fehler-Banner ── */}
      {errorMsg ? (
        <TouchableOpacity
          style={[styles.errorBanner, { backgroundColor: theme.danger }]}
          onPress={() => setErrorMsg('')}
        >
          <Text style={styles.errorBannerText}>{errorMsg} ✕</Text>
        </TouchableOpacity>
      ) : null}

      {/* ── Bestätigungs-Modal ── */}
      <Modal visible={!!confirm} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.confirmBox, { backgroundColor: theme.panel }]}>
            <Text style={[styles.confirmTitle, { color: theme.text }]}>{confirm?.title}</Text>
            <Text style={[styles.confirmMessage, { color: theme.textDim }]}>{confirm?.message}</Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmBtn, { borderColor: theme.muted, borderWidth: 1 }]}
                onPress={() => setConfirm(null)}
              >
                <Text style={{ color: theme.textDim, fontWeight: '600' }}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: theme.danger }]}
                onPress={confirm?.onConfirm}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Beenden</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal: Konsum eintragen ── */}
      <Modal visible={showConsume} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.panel }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {selectedItem?.emoji} {selectedItem?.key}
            </Text>
            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.brand }]} onPress={() => handleConsume(true)}>
              <Text style={[styles.primaryButtonText, { color: theme.bg }]}>Nur für mich</Text>
            </TouchableOpacity>
            <Text style={[styles.modalSubtitle, { color: theme.textDim }]}>Mit anderen teilen:</Text>
            <ScrollView style={{ maxHeight: 200 }}>
              {session?.participants.map(p => (
                <TouchableOpacity
                  key={p.user.id}
                  style={[styles.userRow, { borderBottomColor: theme.muted }]}
                  onPress={() => setShareUserIds(ids =>
                    ids.includes(p.user.id) ? ids.filter(id => id !== p.user.id) : [...ids, p.user.id]
                  )}
                >
                  <Text style={[styles.checkbox, { color: theme.brand }]}>{shareUserIds.includes(p.user.id) ? '☑' : '☐'}</Text>
                  <Text style={[styles.userName, { color: theme.text }]}>{p.user.username}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {shareUserIds.length > 0 && (
              <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.accent }]} onPress={() => handleConsume(false)}>
                <Text style={[styles.primaryButtonText, { color: theme.text }]}>Für Ausgewählte zählen</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setShowConsume(false)}>
              <Text style={[styles.cancelText, { color: theme.textDim }]}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
    </View>
  );
}

// ── Styles (nur Layout, keine Farben) ────────────────────────────

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 26, fontWeight: '700' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 100 },
  emptyText: { fontSize: 18, marginBottom: 24 },

  sessionHeader: { padding: 16, margin: 12, borderRadius: 12 },
  sessionName: { fontSize: 20, fontWeight: 'bold' },
  sessionCode: { fontSize: 13, marginTop: 4 },
  endButton: { marginTop: 8, fontWeight: '600' },

  sectionTitle: { fontSize: 12, fontWeight: 'bold', marginLeft: 16, marginTop: 16, marginBottom: 8, letterSpacing: 1 },

  buttonGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8 },
  counterButton: { width: '22%', aspectRatio: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  counterEmoji: { fontSize: 24 },
  counterLabel: { fontSize: 11, marginTop: 4 },

  notifyRow: { flexDirection: 'row', paddingHorizontal: 12, gap: 8 },
  notifyButton: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1 },
  notifyEmoji: { fontSize: 20 },
  notifyLabel: { fontSize: 11, marginTop: 4, textAlign: 'center' },

  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', margin: 16, padding: 12, borderRadius: 12 },
  toggleLabel: { fontSize: 15 },

  tableRow: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 4 },
  tableCell: { width: 48, textAlign: 'center', fontSize: 14 },
  tableCellName: { width: 90, textAlign: 'left', paddingLeft: 8 },
  tableHeader: { fontWeight: 'bold', fontSize: 12 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 16 },
  modalSubtitle: { fontSize: 14, marginTop: 16, marginBottom: 8 },

  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 8 },

  userRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  checkbox: { fontSize: 20, marginRight: 12 },
  userName: { fontSize: 16 },

  primaryButton: { borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 12 },
  primaryButtonText: { fontWeight: 'bold', fontSize: 16 },
  cancelText: { textAlign: 'center', marginTop: 12, padding: 8 },

  errorBanner: { margin: 12, borderRadius: 10, padding: 14, alignItems: 'center' },
  errorBannerText: { color: '#fff', fontWeight: '600' },

  confirmBox: { margin: 32, borderRadius: 16, padding: 24 },
  confirmTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  confirmMessage: { fontSize: 15, marginBottom: 24 },
  confirmButtons: { flexDirection: 'row', gap: 12 },
  confirmBtn: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center' },
});
