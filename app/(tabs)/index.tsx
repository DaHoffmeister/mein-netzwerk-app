// app/(tabs)/index.tsx
// Home-Screen — Abend mit mehreren Bereichen (Sessions), Konsum, Zusammenfassung

import { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Modal, TextInput, Switch, ActivityIndicator, RefreshControl, FlatList,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/ThemeContext';
import NavLamp from '../../lib/NavLamp';
import { abendApi, usersApi, type Abend, type AbendSession, type SessionStat } from '../../lib/api';
import api from '../../lib/api';
import { getToken } from '../../lib/auth';

// ── Konstanten ───────────────────────────────────────────────────

const ITEMS = [
  { key: 'hopfen',    emoji: '🌿', category: 'alcohol' },
  { key: 'trauben',   emoji: '🍇', category: 'alcohol' },
  { key: 'pistole',   emoji: '🔫', category: 'alcohol' },
  { key: 'aubergine', emoji: '🍆', category: 'alcohol' },
  { key: 'brokkoli',  emoji: '🥦', category: 'drug' },
  { key: 'nase',      emoji: '👃', category: 'drug' },
];

const NOTIFY_TYPES = [
  { key: 'essen',    emoji: '🍕', label: 'Essen da!' },
  { key: 'brokkoli', emoji: '🥦', label: 'Brokkoli läuft!' },
  { key: 'nase',     emoji: '👃', label: 'Nase fertig!' },
];

// ── Hilfsfunktionen ──────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── Hauptkomponente ──────────────────────────────────────────────

export default function HomeScreen() {
  const { theme }  = useTheme();
  const insets     = useSafeAreaInsets();

  const [abend, setAbend]         = useState<Abend | null>(null);
  const [activeSession, setActiveSession] = useState<AbendSession | null>(null);
  const [stats, setStats]         = useState<SessionStat[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allUsers, setAllUsers]   = useState<{ id: number; username: string }[]>([]);

  // Modals
  const [showCreateAbend, setShowCreateAbend]     = useState(false);
  const [showAddSession, setShowAddSession]       = useState(false);
  const [showConsume, setShowConsume]             = useState(false);
  const [showAbendStats, setShowAbendStats]       = useState(false);
  const [selectedItem, setSelectedItem]           = useState<typeof ITEMS[0] | null>(null);
  const [confirm, setConfirm]                     = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [errorMsg, setErrorMsg]                   = useState('');

  // Abend erstellen
  const [abendName, setAbendName]           = useState('');
  const [firstSessionName, setFirstSessionName] = useState('');
  const [selectedUserIds, setSelectedUserIds]   = useState<number[]>([]);

  // Bereich hinzufügen
  const [newSessionName, setNewSessionName]     = useState('');
  const [newSessionUserIds, setNewSessionUserIds] = useState<number[]>([]);

  // Konsum teilen
  const [shareUserIds, setShareUserIds]     = useState<number[]>([]);
  const [notificationsOn, setNotificationsOn] = useState(true);

  // Abendzusammenfassung
  const [abendStats, setAbendStats]         = useState<{ totals: SessionStat[]; perSession: { sessionId: number; sessionName: string; stats: SessionStat[] }[] } | null>(null);
  const [expandedSessions, setExpandedSessions] = useState<number[]>([]);

  // ── Daten laden ──────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!(await getToken())) { setLoading(false); return; }
    try {
      const a = await abendApi.active();
      setAbend(a);
      if (a && a.sessions.length > 0) {
        const first = activeSession
          ? a.sessions.find(s => s.id === activeSession.id) ?? a.sessions[0]
          : a.sessions[0];
        setActiveSession(first);
        const s = await api.get(`/counter/sessions/${first.id}/stats`);
        setStats(s.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeSession?.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function switchSession(session: AbendSession) {
    setActiveSession(session);
    try {
      const s = await api.get(`/counter/sessions/${session.id}/stats`);
      setStats(s.data);
    } catch {}
  }

  async function loadUsers() {
    try { setAllUsers(await usersApi.all()); } catch {}
  }

  // ── Abend erstellen ──────────────────────────────────────────────

  async function handleCreateAbend() {
    if (!firstSessionName.trim()) { setErrorMsg('Bitte einen Bereichsnamen eingeben.'); return; }
    setErrorMsg('');
    try {
      const a = await abendApi.create(firstSessionName.trim(), selectedUserIds, abendName.trim() || undefined);
      setAbend(a);
      setActiveSession(a.sessions[0]);
      setStats([]);
      setShowCreateAbend(false);
      setAbendName(''); setFirstSessionName(''); setSelectedUserIds([]);
    } catch { setErrorMsg('Abend konnte nicht erstellt werden.'); }
  }

  // ── Bereich hinzufügen ───────────────────────────────────────────

  async function handleAddSession() {
    if (!abend || !newSessionName.trim()) { setErrorMsg('Bitte einen Bereichsnamen eingeben.'); return; }
    setErrorMsg('');
    try {
      const session = await abendApi.addSession(abend.id, newSessionName.trim(), newSessionUserIds);
      setAbend(prev => prev ? { ...prev, sessions: [...prev.sessions, session] } : prev);
      setActiveSession(session);
      setStats([]);
      setShowAddSession(false);
      setNewSessionName(''); setNewSessionUserIds([]);
    } catch { setErrorMsg('Bereich konnte nicht erstellt werden.'); }
  }

  // ── Abend beenden ────────────────────────────────────────────────

  function handleEndAbend() {
    setConfirm({
      title: 'Abend beenden',
      message: 'Willst du den Abend wirklich beenden? Alle Bereiche werden geschlossen.',
      onConfirm: async () => {
        if (!abend) return;
        await abendApi.end(abend.id);
        setAbend(null); setActiveSession(null); setStats([]); setConfirm(null);
      },
    });
  }

  // ── Konsum ───────────────────────────────────────────────────────

  function openConsumeModal(item: typeof ITEMS[0]) {
    setSelectedItem(item); setShareUserIds([]); setShowConsume(true);
  }

  async function handleConsume(forSelf: boolean, overrideUserIds?: number[]) {
    if (!activeSession || !selectedItem) return;
    const userIds = forSelf ? undefined : (overrideUserIds ?? shareUserIds);
    try {
      await api.post(`/counter/sessions/${activeSession.id}/consume`, { item: selectedItem.key, userIds });
      setShowConsume(false);
      const s = await api.get(`/counter/sessions/${activeSession.id}/stats`);
      setStats(s.data);
    } catch { setErrorMsg('Konsum konnte nicht eingetragen werden.'); }
  }

  // ── Benachrichtigung ─────────────────────────────────────────────

  async function handleNotify(type: string) {
    if (!activeSession) return;
    try { await api.post(`/counter/sessions/${activeSession.id}/notify`, { type }); } catch {}
  }

  async function handleToggleNotifications(value: boolean) {
    if (!activeSession) return;
    setNotificationsOn(value);
    await api.patch(`/counter/sessions/${activeSession.id}/notifications`, { on: value });
  }

  // ── Abendzusammenfassung ─────────────────────────────────────────

  async function openAbendStats() {
    if (!abend) return;
    try {
      const data = await abendApi.stats(abend.id);
      setAbendStats(data);
      setShowAbendStats(true);
    } catch {}
  }

  // ── Render ───────────────────────────────────────────────────────

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={theme.brand} />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.panel, borderBottomColor: theme.muted, paddingTop: insets.top + 8 }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Home</Text>
        <NavLamp />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.brand} />}
      >
        {/* ── Kein aktiver Abend ── */}
        {!abend && (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: theme.textDim }]}>Kein aktiver Abend</Text>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: theme.brand }]}
              onPress={() => { loadUsers(); setShowCreateAbend(true); }}
            >
              <Text style={[styles.primaryButtonText, { color: theme.bg }]}>🎉 Abend starten</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Aktiver Abend ── */}
        {abend && (
          <>
            {/* Abend-Header */}
            <View style={[styles.abendHeader, { backgroundColor: theme.panel }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.abendDate, { color: theme.brand }]}>{formatDate(abend.date)}</Text>
                {abend.name && <Text style={[styles.abendName, { color: theme.text }]}>{abend.name}</Text>}
              </View>
              <TouchableOpacity onPress={handleEndAbend}>
                <Text style={[styles.endButton, { color: theme.danger }]}>Beenden</Text>
              </TouchableOpacity>
            </View>

            {/* Bereiche-Selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sessionScroll} contentContainerStyle={styles.sessionScrollContent}>
              {abend.sessions.map(s => (
                <TouchableOpacity
                  key={s.id}
                  style={[
                    styles.sessionChip,
                    { backgroundColor: activeSession?.id === s.id ? theme.brand : theme.panel, borderColor: theme.muted },
                  ]}
                  onPress={() => switchSession(s)}
                >
                  <Text style={[styles.sessionChipText, { color: activeSession?.id === s.id ? theme.bg : theme.text }]}>{s.name}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.sessionChip, styles.sessionChipAdd, { borderColor: theme.brand }]}
                onPress={() => { loadUsers(); setShowAddSession(true); }}
              >
                <Text style={[styles.sessionChipText, { color: theme.brand }]}>+ Bereich</Text>
              </TouchableOpacity>
            </ScrollView>

            {activeSession && (
              <>
                {/* Alkohol */}
                <Text style={[styles.sectionTitle, { color: theme.textDim }]}>ALKOHOL</Text>
                <View style={styles.buttonGrid}>
                  {ITEMS.filter(i => i.category === 'alcohol').map(item => (
                    <TouchableOpacity key={item.key} style={[styles.counterButton, { backgroundColor: theme.brand }]} onPress={() => openConsumeModal(item)}>
                      <Text style={styles.counterEmoji}>{item.emoji}</Text>
                      <Text style={[styles.counterLabel, { color: theme.bg }]}>{item.key}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Leckerlies */}
                <Text style={[styles.sectionTitle, { color: theme.textDim }]}>LECKERLIES</Text>
                <View style={styles.buttonGrid}>
                  {ITEMS.filter(i => i.category === 'drug').map(item => (
                    <TouchableOpacity key={item.key} style={[styles.counterButton, { backgroundColor: theme.accent }]} onPress={() => openConsumeModal(item)}>
                      <Text style={styles.counterEmoji}>{item.emoji}</Text>
                      <Text style={[styles.counterLabel, { color: theme.text }]}>{item.key}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Benachrichtigen */}
                <Text style={[styles.sectionTitle, { color: theme.textDim }]}>BENACHRICHTIGEN</Text>
                <View style={styles.notifyRow}>
                  {NOTIFY_TYPES.map(n => (
                    <TouchableOpacity key={n.key} style={[styles.notifyButton, { backgroundColor: theme.panel, borderColor: theme.muted }]} onPress={() => handleNotify(n.key)}>
                      <Text style={styles.notifyEmoji}>{n.emoji}</Text>
                      <Text style={[styles.notifyLabel, { color: theme.textDim }]}>{n.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Notifications Toggle */}
                <View style={[styles.toggleRow, { backgroundColor: theme.panel }]}>
                  <Text style={[styles.toggleLabel, { color: theme.text }]}>🔔 Benachrichtigungen</Text>
                  <Switch value={notificationsOn} onValueChange={handleToggleNotifications} trackColor={{ false: theme.muted, true: theme.brand }} thumbColor={theme.panel} />
                </View>

                {/* Session-Übersicht */}
                <Text style={[styles.sectionTitle, { color: theme.textDim }]}>ÜBERSICHT — {activeSession.name.toUpperCase()}</Text>
                {(() => {
                  const activeItems = ITEMS.filter(item => stats.some(p => (p[item.key as keyof SessionStat] as number) > 0));
                  if (activeItems.length === 0) return (
                    <Text style={{ color: theme.textDim, marginLeft: 16, marginBottom: 12 }}>Noch nichts konsumiert.</Text>
                  );
                  return (
                    <ScrollView horizontal>
                      <View>
                        <View style={styles.tableRow}>
                          <Text style={[styles.tableCell, styles.tableCellName, styles.tableHeader, { color: theme.textDim }]}>Name</Text>
                          {activeItems.map(i => <Text key={i.key} style={[styles.tableCell, styles.tableHeader, { color: theme.textDim }]}>{i.emoji}</Text>)}
                        </View>
                        {stats.map((p, idx) => (
                          <View key={p.userId} style={[styles.tableRow, idx % 2 === 0 && { backgroundColor: theme.panel }]}>
                            <Text style={[styles.tableCell, styles.tableCellName, { color: theme.text }]}>{p.username}</Text>
                            {activeItems.map(i => <Text key={i.key} style={[styles.tableCell, { color: theme.text }]}>{p[i.key as keyof SessionStat] as number}</Text>)}
                          </View>
                        ))}
                      </View>
                    </ScrollView>
                  );
                })()}

                {/* Abendzusammenfassung-Button */}
                <TouchableOpacity style={[styles.abendStatsBtn, { borderColor: theme.brand }]} onPress={openAbendStats}>
                  <Text style={[styles.abendStatsBtnText, { color: theme.brand }]}>📊 Abendzusammenfassung</Text>
                </TouchableOpacity>
              </>
            )}
          </>
        )}

        {/* Fehler-Banner */}
        {errorMsg ? (
          <TouchableOpacity style={[styles.errorBanner, { backgroundColor: theme.danger }]} onPress={() => setErrorMsg('')}>
            <Text style={styles.errorBannerText}>{errorMsg} ✕</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      {/* ── Modal: Abend erstellen ── */}
      <Modal visible={showCreateAbend} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.panel }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Abend starten</Text>
            <TextInput style={[styles.input, { borderColor: theme.muted, color: theme.text, backgroundColor: theme.bg }]}
              placeholder="Abend-Name (optional, z.B. Freitagsrunde)"
              placeholderTextColor={theme.textDim} value={abendName} onChangeText={setAbendName} />
            <TextInput style={[styles.input, { borderColor: theme.brand, color: theme.text, backgroundColor: theme.bg }]}
              placeholder="Erster Bereich (z.B. Wohnzimmer) *"
              placeholderTextColor={theme.textDim} value={firstSessionName} onChangeText={setFirstSessionName} />
            {errorMsg ? <Text style={{ color: theme.danger, marginBottom: 8 }}>{errorMsg}</Text> : null}
            <Text style={[styles.modalSubtitle, { color: theme.textDim }]}>Teilnehmer:</Text>
            <ScrollView style={{ maxHeight: 160 }}>
              {allUsers.map(u => (
                <TouchableOpacity key={u.id} style={[styles.userRow, { borderBottomColor: theme.muted }]}
                  onPress={() => setSelectedUserIds(ids => ids.includes(u.id) ? ids.filter(id => id !== u.id) : [...ids, u.id])}>
                  <Text style={[styles.checkbox, { color: theme.brand }]}>{selectedUserIds.includes(u.id) ? '☑' : '☐'}</Text>
                  <Text style={[styles.userName, { color: theme.text }]}>{u.username}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.brand }]} onPress={handleCreateAbend}>
              <Text style={[styles.primaryButtonText, { color: theme.bg }]}>Starten</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setShowCreateAbend(false); setErrorMsg(''); }}>
              <Text style={[styles.cancelText, { color: theme.textDim }]}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Modal: Bereich hinzufügen ── */}
      <Modal visible={showAddSession} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.panel }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Bereich hinzufügen</Text>
            <TextInput style={[styles.input, { borderColor: theme.brand, color: theme.text, backgroundColor: theme.bg }]}
              placeholder="Name des Bereichs (z.B. Pool) *"
              placeholderTextColor={theme.textDim} value={newSessionName} onChangeText={setNewSessionName} />
            {errorMsg ? <Text style={{ color: theme.danger, marginBottom: 8 }}>{errorMsg}</Text> : null}
            <Text style={[styles.modalSubtitle, { color: theme.textDim }]}>Teilnehmer:</Text>
            <ScrollView style={{ maxHeight: 160 }}>
              {allUsers.map(u => (
                <TouchableOpacity key={u.id} style={[styles.userRow, { borderBottomColor: theme.muted }]}
                  onPress={() => setNewSessionUserIds(ids => ids.includes(u.id) ? ids.filter(id => id !== u.id) : [...ids, u.id])}>
                  <Text style={[styles.checkbox, { color: theme.brand }]}>{newSessionUserIds.includes(u.id) ? '☑' : '☐'}</Text>
                  <Text style={[styles.userName, { color: theme.text }]}>{u.username}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.brand }]} onPress={handleAddSession}>
              <Text style={[styles.primaryButtonText, { color: theme.bg }]}>Hinzufügen</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setShowAddSession(false); setErrorMsg(''); }}>
              <Text style={[styles.cancelText, { color: theme.textDim }]}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Modal: Konsum ── */}
      <Modal visible={showConsume} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.panel }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>{selectedItem?.emoji} {selectedItem?.key}</Text>
            <View style={styles.consumeTopRow}>
              <TouchableOpacity style={[styles.consumeTopBtn, { backgroundColor: theme.brand }]} onPress={() => handleConsume(true)}>
                <Text style={[styles.primaryButtonText, { color: theme.bg }]}>Nur für mich</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.consumeTopBtn, { backgroundColor: theme.accent }]}
                onPress={() => {
                  if (!activeSession) return;
                  const allIds = activeSession.participants.map(p => p.user.id);
                  setShareUserIds(allIds);
                  handleConsume(false, allIds);
                }}>
                <Text style={[styles.primaryButtonText, { color: theme.text }]}>Für alle</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalSubtitle, { color: theme.textDim }]}>Mit anderen teilen:</Text>
            <ScrollView style={{ maxHeight: 200 }}>
              {activeSession?.participants.map(p => (
                <TouchableOpacity key={p.user.id} style={[styles.userRow, { borderBottomColor: theme.muted }]}
                  onPress={() => setShareUserIds(ids => ids.includes(p.user.id) ? ids.filter(id => id !== p.user.id) : [...ids, p.user.id])}>
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

      {/* ── Modal: Abendzusammenfassung ── */}
      <Modal visible={showAbendStats} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.panel, maxHeight: '90%' }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>📊 Abendzusammenfassung</Text>
            <ScrollView>
              {/* Gesamt */}
              <Text style={[styles.sectionTitle, { color: theme.textDim }]}>GESAMT</Text>
              {(() => {
                const totals = abendStats?.totals ?? [];
                const activeItems = ITEMS.filter(item => totals.some(p => (p[item.key as keyof SessionStat] as number) > 0));
                if (activeItems.length === 0) return <Text style={{ color: theme.textDim, marginLeft: 4, marginBottom: 8 }}>Noch nichts konsumiert.</Text>;
                return (
                  <ScrollView horizontal>
                    <View>
                      <View style={styles.tableRow}>
                        <Text style={[styles.tableCell, styles.tableCellName, styles.tableHeader, { color: theme.textDim }]}>Name</Text>
                        {activeItems.map(i => <Text key={i.key} style={[styles.tableCell, styles.tableHeader, { color: theme.textDim }]}>{i.emoji}</Text>)}
                      </View>
                      {totals.map((p, idx) => (
                        <View key={p.userId} style={[styles.tableRow, idx % 2 === 0 && { backgroundColor: theme.bg }]}>
                          <Text style={[styles.tableCell, styles.tableCellName, { color: theme.text }]}>{p.username}</Text>
                          {activeItems.map(i => <Text key={i.key} style={[styles.tableCell, { color: theme.text }]}>{p[i.key as keyof SessionStat] as number}</Text>)}
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                );
              })()}

              {/* Pro Bereich */}
              {abendStats?.perSession.map(ps => (
                <View key={ps.sessionId}>
                  <TouchableOpacity
                    style={[styles.sessionExpandRow, { borderColor: theme.muted }]}
                    onPress={() => setExpandedSessions(ids => ids.includes(ps.sessionId) ? ids.filter(id => id !== ps.sessionId) : [...ids, ps.sessionId])}
                  >
                    <Text style={[styles.sectionTitle, { color: theme.textDim, margin: 0 }]}>{ps.sessionName.toUpperCase()}</Text>
                    <Text style={{ color: theme.textDim }}>{expandedSessions.includes(ps.sessionId) ? '▲' : '▼'}</Text>
                  </TouchableOpacity>
                  {expandedSessions.includes(ps.sessionId) && (() => {
                    const activeItems = ITEMS.filter(item => ps.stats.some(p => (p[item.key as keyof SessionStat] as number) > 0));
                    if (activeItems.length === 0) return <Text style={{ color: theme.textDim, marginLeft: 4, marginBottom: 8 }}>Nichts konsumiert.</Text>;
                    return (
                      <ScrollView horizontal>
                        <View>
                          <View style={styles.tableRow}>
                            <Text style={[styles.tableCell, styles.tableCellName, styles.tableHeader, { color: theme.textDim }]}>Name</Text>
                            {activeItems.map(i => <Text key={i.key} style={[styles.tableCell, styles.tableHeader, { color: theme.textDim }]}>{i.emoji}</Text>)}
                          </View>
                          {ps.stats.map((p, idx) => (
                            <View key={p.userId} style={[styles.tableRow, idx % 2 === 0 && { backgroundColor: theme.bg }]}>
                              <Text style={[styles.tableCell, styles.tableCellName, { color: theme.text }]}>{p.username}</Text>
                              {activeItems.map(i => <Text key={i.key} style={[styles.tableCell, { color: theme.text }]}>{p[i.key as keyof SessionStat] as number}</Text>)}
                            </View>
                          ))}
                        </View>
                      </ScrollView>
                    );
                  })()}
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity onPress={() => setShowAbendStats(false)}>
              <Text style={[styles.cancelText, { color: theme.textDim }]}>Schließen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Bestätigungs-Modal ── */}
      <Modal visible={!!confirm} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.confirmBox, { backgroundColor: theme.panel }]}>
            <Text style={[styles.confirmTitle, { color: theme.text }]}>{confirm?.title}</Text>
            <Text style={[styles.confirmMessage, { color: theme.textDim }]}>{confirm?.message}</Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity style={[styles.confirmBtn, { borderColor: theme.muted, borderWidth: 1 }]} onPress={() => setConfirm(null)}>
                <Text style={{ color: theme.textDim, fontWeight: '600' }}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: theme.danger }]} onPress={confirm?.onConfirm}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Beenden</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 26, fontWeight: '700' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 100 },
  emptyText: { fontSize: 18, marginBottom: 24 },

  abendHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, margin: 12, borderRadius: 12 },
  abendDate: { fontSize: 15, fontWeight: '700' },
  abendName: { fontSize: 13, marginTop: 2 },
  endButton: { fontWeight: '600', fontSize: 14 },

  sessionScroll: { marginTop: 4 },
  sessionScrollContent: { paddingHorizontal: 12, gap: 8, paddingVertical: 8 },
  sessionChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  sessionChipAdd: { backgroundColor: 'transparent' },
  sessionChipText: { fontSize: 14, fontWeight: '600' },

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

  abendStatsBtn: { margin: 16, borderRadius: 10, padding: 14, alignItems: 'center', borderWidth: 1 },
  abendStatsBtnText: { fontWeight: '600', fontSize: 15 },

  sessionExpandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, marginTop: 12, borderTopWidth: 1 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 16 },
  modalSubtitle: { fontSize: 14, marginTop: 16, marginBottom: 8 },

  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 8 },

  userRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  checkbox: { fontSize: 20, marginRight: 12 },
  userName: { fontSize: 16 },

  consumeTopRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  consumeTopBtn: { flex: 1, borderRadius: 10, padding: 14, alignItems: 'center' },

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
