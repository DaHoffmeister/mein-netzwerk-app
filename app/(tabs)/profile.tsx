// app/(tabs)/profile.tsx
// Profil-Screen: Userdaten, Bio, Passwort, Theme-Auswahl, Logout

import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Modal, ActivityIndicator, Image, Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/ThemeContext';
import { THEMES } from '../../lib/themes';
import { deleteToken, deleteUser } from '../../lib/auth';
import { profileApi, type UserProfile } from '../../lib/api';
import api from '../../lib/api';

const BASE_URL = 'https://net.assozrpg.de';

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}
function getHue(name: string) {
  return name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
}

// ── Passwort-Modal ────────────────────────────────────────────────────────────

function PasswordModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function submit() {
    if (next.length < 6) { setError('Neues Passwort muss mindestens 6 Zeichen haben.'); return; }
    if (next !== confirm) { setError('Passwörter stimmen nicht überein.'); return; }
    setBusy(true); setError('');
    try {
      await profileApi.changePassword(current, next);
      setSuccess(true);
      setCurrent(''); setNext(''); setConfirm('');
      setTimeout(() => { setSuccess(false); onClose(); }, 1200);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Fehler beim Ändern');
    } finally { setBusy(false); }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { backgroundColor: theme.panel, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Passwort ändern</Text>
            <TouchableOpacity onPress={onClose}><Text style={{ color: theme.textDim, fontSize: 18 }}>✕</Text></TouchableOpacity>
          </View>
          {['Aktuelles Passwort', 'Neues Passwort', 'Bestätigen'].map((label, i) => {
            const values = [current, next, confirm];
            const setters = [setCurrent, setNext, setConfirm];
            return (
              <TextInput
                key={label}
                style={[styles.input, { color: theme.text, borderColor: theme.muted, backgroundColor: theme.bg }]}
                placeholder={label}
                placeholderTextColor={theme.textDim}
                secureTextEntry
                value={values[i]}
                onChangeText={setters[i]}
              />
            );
          })}
          {!!error && <Text style={styles.errorText}>{error}</Text>}
          {success && <Text style={[styles.errorText, { color: '#4caf50' }]}>✓ Passwort geändert</Text>}
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: current && next && confirm && !busy ? theme.brand : theme.muted }]}
            onPress={submit}
            disabled={!current || !next || !confirm || busy}
          >
            {busy ? <ActivityIndicator color={theme.bg} /> : <Text style={{ color: theme.bg, fontWeight: '700', fontSize: 15 }}>Ändern</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Hauptscreen ───────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingBio, setEditingBio] = useState(false);
  const [bioText, setBioText] = useState('');
  const [savingBio, setSavingBio] = useState(false);
  const [pwVisible, setPwVisible] = useState(false);

  useFocusEffect(useCallback(() => {
    profileApi.me().then((p) => {
      setProfile(p);
      setBioText(p.bio ?? '');
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []));

  async function saveBio() {
    if (savingBio) return;
    setSavingBio(true);
    try {
      await profileApi.updateBio(bioText);
      setProfile((prev) => prev ? { ...prev, bio: bioText } : prev);
      setEditingBio(false);
    } catch {}
    finally { setSavingBio(false); }
  }

  async function handleLogout() {
    await api.post('/auth/logout').catch(() => {});
    await deleteToken();
    await deleteUser();
    router.replace('/(auth)/login');
  }

  const avatarUrl = profile?.avatarUrl ? `${BASE_URL}${profile.avatarUrl}` : null;
  const hue = profile ? getHue(profile.username) : 0;

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={{ paddingTop: insets.top }} />

      {/* ── Profil-Header ── */}
      {loading ? (
        <ActivityIndicator color={theme.brand} style={{ marginTop: 40 }} />
      ) : profile ? (
        <View style={[styles.profileHeader, { backgroundColor: theme.panel }]}>
          {/* Avatar */}
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: `hsl(${hue},45%,38%)` }]}>
              <Text style={styles.avatarText}>{getInitials(profile.username)}</Text>
            </View>
          )}

          <Text style={[styles.username, { color: theme.text }]}>{profile.username}</Text>
          {profile.email && (
            <Text style={[styles.email, { color: theme.textDim }]}>{profile.email}</Text>
          )}

          {/* Bio */}
          {editingBio ? (
            <View style={styles.bioEdit}>
              <TextInput
                style={[styles.bioInput, { color: theme.text, borderColor: theme.brand, backgroundColor: theme.bg }]}
                value={bioText}
                onChangeText={setBioText}
                multiline
                autoFocus
                maxLength={300}
                placeholder="Über dich…"
                placeholderTextColor={theme.textDim}
              />
              <View style={styles.bioActions}>
                <TouchableOpacity onPress={() => { setEditingBio(false); setBioText(profile.bio ?? ''); }}>
                  <Text style={[styles.bioCancel, { color: theme.textDim }]}>Abbrechen</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={saveBio}
                  style={[styles.bioSaveBtn, { backgroundColor: theme.brand }]}
                  disabled={savingBio}
                >
                  {savingBio
                    ? <ActivityIndicator size="small" color={theme.bg} />
                    : <Text style={{ color: theme.bg, fontWeight: '700', fontSize: 13 }}>Speichern</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setEditingBio(true)} style={styles.bioRow}>
              <Text style={[styles.bio, { color: profile.bio ? theme.text : theme.textDim }]}>
                {profile.bio || 'Bio hinzufügen…'}
              </Text>
              <Text style={[styles.bioEditIcon, { color: theme.brand }]}>✎</Text>
            </TouchableOpacity>
          )}

          {/* Gruppen */}
          {profile.groups.length > 0 && (
            <View style={styles.groups}>
              {profile.groups.map((g) => (
                <View key={g.id} style={[styles.groupChip, { backgroundColor: theme.brand + '22', borderColor: theme.brand + '55' }]}>
                  <Text style={[styles.groupChipText, { color: theme.brand }]}>{g.name}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      ) : null}

      {/* ── Account ── */}
      <Text style={[styles.sectionTitle, { color: theme.textDim }]}>ACCOUNT</Text>
      <View style={[styles.card, { backgroundColor: theme.panel }]}>
        <TouchableOpacity style={[styles.row, { borderBottomColor: theme.muted }]} onPress={() => setPwVisible(true)}>
          <Text style={[styles.rowLabel, { color: theme.text }]}>Passwort ändern</Text>
          <Text style={{ color: theme.textDim }}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.row, { borderBottomWidth: 0 }]} onPress={handleLogout}>
          <Text style={[styles.rowLabel, { color: theme.danger }]}>Ausloggen</Text>
        </TouchableOpacity>
      </View>

      {/* ── Design ── */}
      <Text style={[styles.sectionTitle, { color: theme.textDim }]}>DESIGN</Text>
      <View style={[styles.card, { backgroundColor: theme.panel }]}>
        {THEMES.map((t, i) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.themeRow, { borderBottomColor: theme.muted }, i === THEMES.length - 1 && { borderBottomWidth: 0 }, t.key === theme.key && { backgroundColor: theme.muted }]}
            onPress={() => setTheme(t.key)}
          >
            <Text style={styles.themeEmoji}>{t.emoji}</Text>
            <Text style={[styles.rowLabel, { color: theme.text }]}>{t.label}</Text>
            {t.key === theme.key && <Text style={[styles.checkmark, { color: theme.brand }]}>✓</Text>}
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ height: insets.bottom + 24 }} />

      <PasswordModal visible={pwVisible} onClose={() => setPwVisible(false)} />
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  profileHeader: { margin: 12, borderRadius: 16, padding: 20, alignItems: 'center', gap: 8 },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 30, fontWeight: '700' },
  username: { fontSize: 22, fontWeight: '700', marginTop: 4 },
  email: { fontSize: 13 },

  bioRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 4 },
  bio: { flex: 1, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  bioEditIcon: { fontSize: 16, marginTop: 2 },
  bioEdit: { width: '100%', gap: 8 },
  bioInput: { borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 14, minHeight: 70, textAlignVertical: 'top' },
  bioActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  bioCancel: { fontSize: 14, paddingVertical: 6 },
  bioSaveBtn: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },

  groups: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 4 },
  groupChip: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  groupChipText: { fontSize: 12, fontWeight: '600' },

  sectionTitle: { fontSize: 11, fontWeight: 'bold', letterSpacing: 1, marginLeft: 16, marginTop: 20, marginBottom: 8 },
  card: { marginHorizontal: 12, borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  rowLabel: { flex: 1, fontSize: 16 },
  themeRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  themeEmoji: { fontSize: 22, marginRight: 12 },
  checkmark: { fontSize: 18, fontWeight: 'bold' },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, fontSize: 15, marginBottom: 12 },
  errorText: { color: '#ff6b6b', fontSize: 13, marginBottom: 8 },
  submitBtn: { borderRadius: 12, padding: 14, alignItems: 'center' },
});
