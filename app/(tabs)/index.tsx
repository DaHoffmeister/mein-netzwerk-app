// app/(tabs)/index.tsx
// Home-Screen — Join Session verwalten, Konsum zählen, Benachrichtigungen senden

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Modal, TextInput, Switch, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import api from '../../lib/api';

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
  { key: 'Joint',    emoji: '🌿', category: 'drug' },
  { key: 'Line',     emoji: '❄️', category: 'drug' },
];

const NOTIFY_TYPES = [
  { key: 'essen', emoji: '🍕', label: 'Essen da!' },
  { key: 'joint', emoji: '🌿', label: 'Joint läuft!' },
  { key: 'line',  emoji: '❄️', label: 'Lines fertig!' },
];

// ── Hauptkomponente ──────────────────────────────────────────────

export default function HomeScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [stats, setStats] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [showConsume, setShowConsume] = useState(false);
  const [selectedItem, setSelectedItem] = useState<typeof ITEMS[0] | null>(null);

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
    try {
      const res = await api.get('/counter/sessions/active');
      setSession(res.data);
      if (res.data) {
        const statsRes = await api.get(`/counter/sessions/${res.data.id}/stats`);
        setStats(statsRes.data);
        // Eigene Notification-Einstellung
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

  // Beim Fokussieren des Tabs neu laden
  useFocusEffect(useCallback(() => { loadSession(); }, [loadSession]));

  // Alle User für Dropdown laden
  async function loadUsers() {
    try {
      const res = await api.get('/users');
      setAllUsers(res.data);
    } catch {}
  }

  // ── Session erstellen ────────────────────────────────────────────

  async function handleCreateSession() {
    if (!sessionName.trim()) return;
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
      Alert.alert('Fehler', 'Session konnte nicht erstellt werden.');
    }
  }

  // ── Session beenden ──────────────────────────────────────────────

  async function handleEndSession() {
    Alert.alert('Session beenden', 'Willst du den Abend wirklich beenden?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Beenden', style: 'destructive',
        onPress: async () => {
          await api.post(`/counter/sessions/${session!.id}/end`);
          setSession(null);
          setStats([]);
        },
      },
    ]);
  }

  // ── Konsum eintragen ─────────────────────────────────────────────

  function openConsumeModal(item: typeof ITEMS[0]) {
    setSelectedItem(item);
    setShareUserIds([]); // Default: nur für sich selbst
    setShowConsume(true);
  }

  async function handleConsume(forSelf: boolean) {
    if (!session || !selectedItem) return;
    const userIds = forSelf
      ? undefined // Backend-Default: nur eigene ID
      : shareUserIds;

    try {
      await api.post(`/counter/sessions/${session.id}/consume`, {
        item: selectedItem.key,
        userIds,
      });
      setShowConsume(false);
      loadSession();
    } catch {
      Alert.alert('Fehler', 'Konsum konnte nicht eingetragen werden.');
    }
  }

  // ── Benachrichtigung senden ──────────────────────────────────────

  async function handleNotify(type: string) {
    if (!session) return;
    try {
      await api.post(`/counter/sessions/${session.id}/notify`, { type });
    } catch {
      Alert.alert('Fehler', 'Benachrichtigung konnte nicht gesendet werden.');
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
    return <ActivityIndicator style={{ flex: 1 }} />;
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadSession(); }} />}
    >
      {/* ── Kein aktiver Abend ── */}
      {!session && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Kein aktiver Abend</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => { loadUsers(); setShowCreate(true); }}>
            <Text style={styles.primaryButtonText}>🎉 Abend starten</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Aktiver Abend ── */}
      {session && (
        <>
          {/* Header */}
          <View style={styles.sessionHeader}>
            <Text style={styles.sessionName}>{session.name}</Text>
            <Text style={styles.sessionCode}>Code: {session.code}</Text>
            <TouchableOpacity onPress={handleEndSession}>
              <Text style={styles.endButton}>Beenden</Text>
            </TouchableOpacity>
          </View>

          {/* Alkohol-Buttons */}
          <Text style={styles.sectionTitle}>ALKOHOL</Text>
          <View style={styles.buttonGrid}>
            {ITEMS.filter(i => i.category === 'alcohol').map(item => (
              <TouchableOpacity key={item.key} style={styles.counterButton} onPress={() => openConsumeModal(item)}>
                <Text style={styles.counterEmoji}>{item.emoji}</Text>
                <Text style={styles.counterLabel}>{item.key}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Sonstiges-Buttons */}
          <Text style={styles.sectionTitle}>SONSTIGES</Text>
          <View style={styles.buttonGrid}>
            {ITEMS.filter(i => i.category === 'drug').map(item => (
              <TouchableOpacity key={item.key} style={[styles.counterButton, styles.drugButton]} onPress={() => openConsumeModal(item)}>
                <Text style={styles.counterEmoji}>{item.emoji}</Text>
                <Text style={styles.counterLabel}>{item.key}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Benachrichtigungs-Buttons */}
          <Text style={styles.sectionTitle}>BENACHRICHTIGEN</Text>
          <View style={styles.notifyRow}>
            {NOTIFY_TYPES.map(n => (
              <TouchableOpacity key={n.key} style={styles.notifyButton} onPress={() => handleNotify(n.key)}>
                <Text style={styles.notifyEmoji}>{n.emoji}</Text>
                <Text style={styles.notifyLabel}>{n.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Notifications Toggle */}
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>🔔 Benachrichtigungen</Text>
            <Switch value={notificationsOn} onValueChange={handleToggleNotifications} />
          </View>

          {/* Stats-Tabelle */}
          <Text style={styles.sectionTitle}>ÜBERSICHT</Text>
          <ScrollView horizontal>
            <View>
              {/* Header-Zeile */}
              <View style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.tableCellName, styles.tableHeader]}>Name</Text>
                {ITEMS.map(i => (
                  <Text key={i.key} style={[styles.tableCell, styles.tableHeader]}>{i.emoji}</Text>
                ))}
              </View>
              {/* Daten-Zeilen */}
              {stats.map((p, idx) => (
                <View key={p.userId} style={[styles.tableRow, idx % 2 === 0 && styles.tableRowEven]}>
                  <Text style={[styles.tableCell, styles.tableCellName]}>{p.username}</Text>
                  {ITEMS.map(i => (
                    <Text key={i.key} style={styles.tableCell}>{p[i.key as keyof Participant] as number}</Text>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        </>
      )}

      {/* ── Modal: Session erstellen ── */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Abend starten</Text>
            <TextInput
              style={styles.input}
              placeholder="Name des Abends"
              value={sessionName}
              onChangeText={setSessionName}
            />
            <Text style={styles.modalSubtitle}>Teilnehmer auswählen:</Text>
            <ScrollView style={{ maxHeight: 200 }}>
              {allUsers.map(u => (
                <TouchableOpacity
                  key={u.id}
                  style={styles.userRow}
                  onPress={() => setSelectedUserIds(ids =>
                    ids.includes(u.id) ? ids.filter(id => id !== u.id) : [...ids, u.id]
                  )}
                >
                  <Text style={styles.checkbox}>{selectedUserIds.includes(u.id) ? '☑' : '☐'}</Text>
                  <Text style={styles.userName}>{u.username}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.primaryButton} onPress={handleCreateSession}>
              <Text style={styles.primaryButtonText}>Erstellen</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <Text style={styles.cancelText}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Modal: Konsum eintragen ── */}
      <Modal visible={showConsume} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {selectedItem?.emoji} {selectedItem?.key}
            </Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => handleConsume(true)}>
              <Text style={styles.primaryButtonText}>Nur für mich</Text>
            </TouchableOpacity>
            <Text style={styles.modalSubtitle}>Mit anderen teilen:</Text>
            <ScrollView style={{ maxHeight: 200 }}>
              {session?.participants.map(p => (
                <TouchableOpacity
                  key={p.user.id}
                  style={styles.userRow}
                  onPress={() => setShareUserIds(ids =>
                    ids.includes(p.user.id) ? ids.filter(id => id !== p.user.id) : [...ids, p.user.id]
                  )}
                >
                  <Text style={styles.checkbox}>{shareUserIds.includes(p.user.id) ? '☑' : '☐'}</Text>
                  <Text style={styles.userName}>{p.user.username}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {shareUserIds.length > 0 && (
              <TouchableOpacity style={[styles.primaryButton, { backgroundColor: '#e67e22' }]} onPress={() => handleConsume(false)}>
                <Text style={styles.primaryButtonText}>Für Ausgewählte zählen</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setShowConsume(false)}>
              <Text style={styles.cancelText}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ── Styles ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 100 },
  emptyText: { fontSize: 18, color: '#999', marginBottom: 24 },

  sessionHeader: { backgroundColor: '#2c3e50', padding: 16, margin: 12, borderRadius: 12 },
  sessionName: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  sessionCode: { fontSize: 13, color: '#bdc3c7', marginTop: 4 },
  endButton: { color: '#e74c3c', marginTop: 8, fontWeight: '600' },

  sectionTitle: { fontSize: 12, fontWeight: 'bold', color: '#999', marginLeft: 16, marginTop: 16, marginBottom: 8, letterSpacing: 1 },

  buttonGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8 },
  counterButton: { width: '22%', aspectRatio: 1, backgroundColor: '#3498db', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  drugButton: { backgroundColor: '#27ae60' },
  counterEmoji: { fontSize: 24 },
  counterLabel: { fontSize: 11, color: '#fff', marginTop: 4 },

  notifyRow: { flexDirection: 'row', paddingHorizontal: 12, gap: 8 },
  notifyButton: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#ddd' },
  notifyEmoji: { fontSize: 20 },
  notifyLabel: { fontSize: 11, color: '#555', marginTop: 4, textAlign: 'center' },

  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', margin: 16, padding: 12, backgroundColor: '#fff', borderRadius: 12 },
  toggleLabel: { fontSize: 15, color: '#333' },

  tableRow: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 4 },
  tableRowEven: { backgroundColor: '#f0f0f0' },
  tableCell: { width: 48, textAlign: 'center', fontSize: 14, color: '#333' },
  tableCellName: { width: 90, textAlign: 'left', paddingLeft: 8 },
  tableHeader: { fontWeight: 'bold', color: '#555', fontSize: 12 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 16 },
  modalSubtitle: { fontSize: 14, color: '#999', marginTop: 16, marginBottom: 8 },

  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 8 },

  userRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  checkbox: { fontSize: 20, marginRight: 12 },
  userName: { fontSize: 16 },

  primaryButton: { backgroundColor: '#3498db', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 12 },
  primaryButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  cancelText: { textAlign: 'center', color: '#999', marginTop: 12, padding: 8 },
});
