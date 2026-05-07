// app/(tabs)/groups.tsx
// Gruppenübersicht — Liste aller Gruppen, beitreten/verlassen, neue Gruppe erstellen

import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal, TextInput,
  Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/ThemeContext';
import NavLamp from '../../lib/NavLamp';
import { groupsApi, type Group } from '../../lib/api';

const BASE_URL = 'https://net.assozrpg.de';

function getHue(name: string) {
  return name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
}

// ── Gruppen-Karte ─────────────────────────────────────────────────────────────

function GroupCard({ group, onPress, onJoinLeave }: {
  group: Group;
  onPress: () => void;
  onJoinLeave: (group: Group) => void;
}) {
  const { theme } = useTheme();
  const [busy, setBusy] = useState(false);
  const isMember = !!group.myRole;
  const imgUrl = group.imageUrl ? `${BASE_URL}${group.imageUrl}` : null;
  const hue = getHue(group.name);

  async function handleJoinLeave() {
    setBusy(true);
    try {
      if (isMember) {
        await groupsApi.leave(group.id);
      } else {
        await groupsApi.join(group.id);
      }
      onJoinLeave(group);
    } catch {}
    finally { setBusy(false); }
  }

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.panel }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Avatar */}
      {imgUrl ? (
        <Image source={{ uri: imgUrl }} style={styles.groupImg} />
      ) : (
        <View style={[styles.groupImgFallback, { backgroundColor: `hsl(${hue},45%,32%)` }]}>
          <Text style={styles.groupImgText}>{group.name[0]?.toUpperCase()}</Text>
        </View>
      )}

      {/* Info */}
      <View style={styles.cardBody}>
        <Text style={[styles.cardName, { color: theme.text }]} numberOfLines={1}>{group.name}</Text>
        {!!group.description && (
          <Text style={[styles.cardDesc, { color: theme.textDim }]} numberOfLines={2}>{group.description}</Text>
        )}
        <Text style={[styles.cardMeta, { color: theme.textDim }]}>
          {group.memberCount} Mitglieder · {group.postCount} Posts
        </Text>
      </View>

      {/* Join/Leave */}
      <TouchableOpacity
        onPress={handleJoinLeave}
        disabled={busy || group.myRole === 'ADMIN'}
        style={[
          styles.joinBtn,
          { borderColor: isMember ? theme.muted : theme.brand },
          isMember && { backgroundColor: theme.muted + '33' },
          !isMember && { backgroundColor: theme.brand },
        ]}
      >
        {busy
          ? <ActivityIndicator size="small" color={isMember ? theme.textDim : theme.bg} />
          : <Text style={[styles.joinBtnText, { color: isMember ? theme.textDim : theme.bg }]}>
              {group.myRole === 'ADMIN' ? 'Admin' : isMember ? 'Verlassen' : 'Beitreten'}
            </Text>
        }
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ── Neue Gruppe Modal ─────────────────────────────────────────────────────────

function NewGroupModal({ visible, onClose, onCreated }: {
  visible: boolean;
  onClose: () => void;
  onCreated: (g: Group) => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const g = await groupsApi.create(name.trim(), desc.trim());
      setName(''); setDesc('');
      onCreated(g);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Fehler beim Erstellen');
    } finally { setBusy(false); }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: theme.panel, paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Neue Gruppe</Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={{ color: theme.textDim, fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.muted, backgroundColor: theme.bg }]}
              placeholder="Name *"
              placeholderTextColor={theme.textDim}
              value={name}
              onChangeText={setName}
              autoFocus
              maxLength={60}
            />
            <TextInput
              style={[styles.input, styles.inputMulti, { color: theme.text, borderColor: theme.muted, backgroundColor: theme.bg }]}
              placeholder="Beschreibung (optional)"
              placeholderTextColor={theme.textDim}
              value={desc}
              onChangeText={setDesc}
              multiline
              maxLength={300}
            />
            {!!error && <Text style={styles.errorText}>{error}</Text>}
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: name.trim() && !busy ? theme.brand : theme.muted }]}
              onPress={submit}
              disabled={!name.trim() || busy}
            >
              {busy
                ? <ActivityIndicator color={theme.bg} />
                : <Text style={{ color: theme.bg, fontWeight: '700', fontSize: 15 }}>Erstellen</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Hauptscreen ───────────────────────────────────────────────────────────────

export default function GroupsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newGroupVisible, setNewGroupVisible] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await groupsApi.list();
      setGroups(data);
    } catch (err) {
      console.error('Gruppen laden fehlgeschlagen:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  function onJoinLeave(changed: Group) {
    // Neu laden um aktuelle Mitgliedschaft zu bekommen
    load();
  }

  function onCreated(g: Group) {
    setGroups((prev) => [g, ...prev]);
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { backgroundColor: theme.panel, borderBottomColor: theme.muted, paddingTop: insets.top + 8 }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Gruppen</Text>
        <NavLamp />
        <TouchableOpacity onPress={() => setNewGroupVisible(true)} hitSlop={12}>
          <Text style={[styles.newBtn, { color: theme.brand }]}>＋</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color={theme.brand} />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => String(g.id)}
          renderItem={({ item }) => (
            <GroupCard
              group={item}
              onPress={() => router.push({ pathname: '/group/[id]', params: { id: item.id, name: item.name } })}
              onJoinLeave={onJoinLeave}
            />
          )}
          contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: insets.bottom + 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.brand} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: theme.textDim }]}>Noch keine Gruppen</Text>
            </View>
          }
        />
      )}

      <NewGroupModal
        visible={newGroupVisible}
        onClose={() => setNewGroupVisible(false)}
        onCreated={onCreated}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 26, fontWeight: '700' },
  newBtn: { fontSize: 28, fontWeight: '300' },

  card: { borderRadius: 14, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 },
  groupImg: { width: 52, height: 52, borderRadius: 12, flexShrink: 0 },
  groupImgFallback: { width: 52, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  groupImgText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  cardBody: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  cardDesc: { fontSize: 13, lineHeight: 18, marginBottom: 4 },
  cardMeta: { fontSize: 12 },
  joinBtn: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, flexShrink: 0, minWidth: 80, alignItems: 'center' },
  joinBtnText: { fontSize: 13, fontWeight: '600' },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, fontSize: 15, marginBottom: 12 },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
  errorText: { color: '#ff6b6b', fontSize: 13, marginBottom: 8 },
  submitBtn: { borderRadius: 12, padding: 14, alignItems: 'center' },

  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 15 },
});
