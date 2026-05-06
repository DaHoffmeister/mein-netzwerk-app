// app/(tabs)/events.tsx
// Events — Liste, RSVP, neues Event erstellen

import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal, TextInput,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/ThemeContext';
import { eventsApi, type Event } from '../../lib/api';

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function formatDateShort(iso: string) {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString('de-DE', { day: '2-digit' }),
    month: d.toLocaleDateString('de-DE', { month: 'short' }).toUpperCase(),
    weekday: d.toLocaleDateString('de-DE', { weekday: 'short' }),
  };
}

// Parst "DD.MM.YYYY HH:MM" zu ISO-String
function parseDateTime(date: string, time: string): string | null {
  try {
    const [day, month, year] = date.split('.').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    if ([day, month, year, hour, minute].some(isNaN)) return null;
    const d = new Date(year, month - 1, day, hour, minute);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch { return null; }
}

// ── RSVP-Leiste ───────────────────────────────────────────────────────────────

const RSVP_OPTIONS: { status: 'GOING' | 'MAYBE' | 'NOT_GOING'; label: string; emoji: string }[] = [
  { status: 'GOING',     label: 'Dabei',     emoji: '✓' },
  { status: 'MAYBE',     label: 'Vielleicht', emoji: '?' },
  { status: 'NOT_GOING', label: 'Absagen',   emoji: '✗' },
];

function RsvpBar({ event, onUpdate }: { event: Event; onUpdate: (id: number, rsvpCounts: Event['rsvpCounts'], myRsvp: Event['myRsvp']) => void }) {
  const { theme } = useTheme();
  const [busy, setBusy] = useState(false);
  const [myRsvp, setMyRsvp] = useState(event.myRsvp);
  const [counts, setCounts] = useState(event.rsvpCounts ?? { GOING: 0, MAYBE: 0, NOT_GOING: 0 });

  async function toggle(status: 'GOING' | 'MAYBE' | 'NOT_GOING') {
    if (busy) return;
    setBusy(true);
    try {
      const res = await eventsApi.rsvp(event.id, status);
      setMyRsvp(res.myRsvp);
      setCounts(res.rsvpCounts ?? { GOING: 0, MAYBE: 0, NOT_GOING: 0 });
      onUpdate(event.id, res.rsvpCounts, res.myRsvp);
    } catch {}
    finally { setBusy(false); }
  }

  return (
    <View style={styles.rsvpBar}>
      {RSVP_OPTIONS.map(({ status, label, emoji }) => {
        const active = myRsvp === status;
        const count = counts?.[status] ?? 0;
        const colors = { GOING: '#4caf50', MAYBE: '#ff9800', NOT_GOING: '#f44336' };
        const color = colors[status];
        return (
          <TouchableOpacity
            key={status}
            onPress={() => toggle(status)}
            disabled={busy}
            style={[
              styles.rsvpBtn,
              { borderColor: active ? color : theme.muted },
              active && { backgroundColor: color + '22' },
            ]}
          >
            <Text style={{ color: active ? color : theme.textDim, fontSize: 14, fontWeight: '700' }}>{emoji}</Text>
            <Text style={{ color: active ? color : theme.textDim, fontSize: 12, fontWeight: '600' }}> {label}</Text>
            {count > 0 && (
              <View style={[styles.rsvpCount, { backgroundColor: active ? color : theme.muted }]}>
                <Text style={{ color: active ? '#fff' : theme.textDim, fontSize: 10, fontWeight: '700' }}>{count}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Event-Karte ───────────────────────────────────────────────────────────────

function EventCard({ event, onUpdate }: { event: Event; onUpdate: (id: number, rsvpCounts: Event['rsvpCounts'], myRsvp: Event['myRsvp']) => void }) {
  const { theme } = useTheme();
  const { day, month, weekday } = formatDateShort(event.startTime);
  const isPast = new Date(event.endTime) < new Date();

  return (
    <View style={[styles.card, { backgroundColor: theme.panel }, isPast && { opacity: 0.6 }]}>
      {/* Datum-Badge links */}
      <View style={[styles.dateBadge, { backgroundColor: theme.brand + '22', borderColor: theme.brand + '44' }]}>
        <Text style={[styles.dateBadgeWeekday, { color: theme.brand }]}>{weekday}</Text>
        <Text style={[styles.dateBadgeDay, { color: theme.text }]}>{day}</Text>
        <Text style={[styles.dateBadgeMonth, { color: theme.brand }]}>{month}</Text>
      </View>

      {/* Inhalt */}
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={2}>{event.title}</Text>

        <Text style={[styles.cardMeta, { color: theme.textDim }]}>
          🕐 {formatTime(event.startTime)} – {formatTime(event.endTime)}
        </Text>

        {!!event.location && (
          <Text style={[styles.cardMeta, { color: theme.textDim }]} numberOfLines={1}>
            📍 {event.location}
          </Text>
        )}

        {!!event.description && (
          <Text style={[styles.cardDesc, { color: theme.textDim }]} numberOfLines={2}>{event.description}</Text>
        )}

        <RsvpBar event={event} onUpdate={onUpdate} />
      </View>
    </View>
  );
}

// ── Neues Event Modal ─────────────────────────────────────────────────────────

function NewEventModal({ visible, onClose, onCreated }: {
  visible: boolean;
  onClose: () => void;
  onCreated: (e: Event) => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [title, setTitle]       = useState('');
  const [desc, setDesc]         = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate]   = useState('');
  const [endTime, setEndTime]   = useState('');
  const [location, setLocation] = useState('');
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState('');

  async function submit() {
    if (!title.trim()) { setError('Titel fehlt.'); return; }
    const startISO = parseDateTime(startDate, startTime);
    const endISO   = parseDateTime(endDate || startDate, endTime || startTime);
    if (!startISO || !endISO) { setError('Datum/Zeit ungültig. Format: DD.MM.YYYY und HH:MM'); return; }
    if (endISO <= startISO) { setError('Ende muss nach dem Start liegen.'); return; }

    setBusy(true); setError('');
    try {
      const ev = await eventsApi.create({
        title: title.trim(),
        description: desc.trim() || undefined,
        startTime: startISO,
        endTime: endISO,
        location: location.trim() || undefined,
      });
      setTitle(''); setDesc(''); setStartDate(''); setStartTime('');
      setEndDate(''); setEndTime(''); setLocation('');
      onCreated(ev);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Fehler beim Erstellen');
    } finally { setBusy(false); }
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.muted, backgroundColor: theme.bg }];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.modalOverlay}>
          <ScrollView style={[styles.modalSheet, { backgroundColor: theme.panel }]} contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 20 }}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Neues Event</Text>
              <TouchableOpacity onPress={onClose}><Text style={{ color: theme.textDim, fontSize: 18 }}>✕</Text></TouchableOpacity>
            </View>

            <TextInput style={inputStyle} placeholder="Titel *" placeholderTextColor={theme.textDim} value={title} onChangeText={setTitle} autoFocus />

            <View style={styles.row2}>
              <TextInput style={[inputStyle, { flex: 1 }]} placeholder="Start: DD.MM.YYYY" placeholderTextColor={theme.textDim} value={startDate} onChangeText={setStartDate} keyboardType="numeric" />
              <TextInput style={[inputStyle, { width: 90 }]} placeholder="HH:MM" placeholderTextColor={theme.textDim} value={startTime} onChangeText={setStartTime} keyboardType="numeric" />
            </View>

            <View style={styles.row2}>
              <TextInput style={[inputStyle, { flex: 1 }]} placeholder="Ende: DD.MM.YYYY" placeholderTextColor={theme.textDim} value={endDate} onChangeText={setEndDate} keyboardType="numeric" />
              <TextInput style={[inputStyle, { width: 90 }]} placeholder="HH:MM" placeholderTextColor={theme.textDim} value={endTime} onChangeText={setEndTime} keyboardType="numeric" />
            </View>

            <TextInput style={inputStyle} placeholder="Ort (optional)" placeholderTextColor={theme.textDim} value={location} onChangeText={setLocation} />
            <TextInput style={[inputStyle, { minHeight: 70, textAlignVertical: 'top' }]} placeholder="Beschreibung (optional)" placeholderTextColor={theme.textDim} value={desc} onChangeText={setDesc} multiline />

            {!!error && <Text style={styles.errorText}>{error}</Text>}

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: title.trim() && !busy ? theme.brand : theme.muted }]}
              onPress={submit}
              disabled={!title.trim() || busy}
            >
              {busy ? <ActivityIndicator color={theme.bg} /> : <Text style={{ color: theme.bg, fontWeight: '700', fontSize: 15 }}>Erstellen</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Hauptscreen ───────────────────────────────────────────────────────────────

export default function EventsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newVisible, setNewVisible] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await eventsApi.upcoming(30);
      setEvents(data);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  function onUpdate(id: number, rsvpCounts: Event['rsvpCounts'], myRsvp: Event['myRsvp']) {
    setEvents((prev) => prev.map((e) => e.id === id ? { ...e, rsvpCounts, myRsvp } : e));
  }

  function onCreated(ev: Event) {
    setEvents((prev) => [ev, ...prev].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()));
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { backgroundColor: theme.panel, borderBottomColor: theme.muted, paddingTop: insets.top + 8 }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Events</Text>
        <TouchableOpacity onPress={() => setNewVisible(true)} hitSlop={12}>
          <Text style={[styles.newBtn, { color: theme.brand }]}>＋</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color={theme.brand} />
      ) : (
        <FlatList
          data={events}
          keyExtractor={(e) => String(e.id)}
          renderItem={({ item }) => <EventCard event={item} onUpdate={onUpdate} />}
          contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: insets.bottom + 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.brand} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: theme.textDim }]}>Keine bevorstehenden Events</Text>
            </View>
          }
        />
      )}

      <NewEventModal visible={newVisible} onClose={() => setNewVisible(false)} onCreated={onCreated} />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 26, fontWeight: '700' },
  newBtn: { fontSize: 28, fontWeight: '300' },

  card: { borderRadius: 14, flexDirection: 'row', padding: 14, gap: 12 },
  dateBadge: { width: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, paddingVertical: 8, flexShrink: 0 },
  dateBadgeWeekday: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  dateBadgeDay: { fontSize: 22, fontWeight: '700', lineHeight: 26 },
  dateBadgeMonth: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  cardBody: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 16, fontWeight: '700', lineHeight: 21 },
  cardMeta: { fontSize: 13 },
  cardDesc: { fontSize: 13, lineHeight: 18, marginTop: 2 },

  rsvpBar: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  rsvpBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5, gap: 2 },
  rsvpCount: { borderRadius: 8, minWidth: 16, paddingHorizontal: 4, alignItems: 'center', marginLeft: 2 },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, fontSize: 15, marginBottom: 12 },
  row2: { flexDirection: 'row', gap: 8 },
  errorText: { color: '#ff6b6b', fontSize: 13, marginBottom: 8 },
  submitBtn: { borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 4 },

  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 15 },
});
