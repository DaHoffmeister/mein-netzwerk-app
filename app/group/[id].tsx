// app/group/[id].tsx
// Gruppen-Detail: Posts, Reaktionen, Kommentare

import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Modal,
  Image, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '../../lib/ThemeContext';
import { getUser } from '../../lib/auth';
import { groupsApi, type GroupPost, type Comment, type GroupRoom, type AbendSummaryMeta, type SessionStat } from '../../lib/api';
import { useWindowDimensions } from 'react-native';

const BASE_URL = 'https://net.assozrpg.de';

const GROUP_REACTIONS = ['👍', '❤️', '😂', '🔥', '😮'];

function formatTime(iso: string) {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'gerade eben';
  if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min.`;
  if (diff < 86400) return `vor ${Math.floor(diff / 3600)} Std.`;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

function getHue(name: string) {
  return name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ user, size = 36 }: { user: GroupPost['user']; size?: number }) {
  const url = user.avatarUrl ? `${BASE_URL}${user.avatarUrl}` : null;
  const hue = getHue(user.username);
  return url ? (
    <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  ) : (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: `hsl(${hue},45%,38%)`, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontSize: size * 0.38, fontWeight: '700' }}>{getInitials(user.username)}</Text>
    </View>
  );
}

// ── Kommentare ────────────────────────────────────────────────────────────────

function GroupCommentSection({ groupId, postId, myUserId }: { groupId: number; postId: number; myUserId: number }) {
  const { theme } = useTheme();
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  useFocusEffect(useCallback(() => {
    groupsApi.comments(groupId, postId)
      .then((r) => setComments(r.comments))
      .catch(() => {});
  }, [groupId, postId]));

  async function send() {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    setText('');
    try {
      const c = await groupsApi.createComment(groupId, postId, t);
      setComments((prev) => [...prev, c]);
    } catch {}
    finally { setSending(false); }
  }

  async function del(id: number) {
    try {
      await groupsApi.deleteComment(groupId, postId, id);
      setComments((prev) => prev.filter((c) => c.id !== id));
    } catch {}
  }

  return (
    <View style={[styles.commentSection, { borderTopColor: theme.muted }]}>
      {comments.map((c) => (
        <View key={c.id} style={styles.commentRow}>
          <Avatar user={c.user} size={26} />
          <View style={[styles.commentBubble, { backgroundColor: theme.panel }]}>
            <Text style={[styles.commentUser, { color: theme.brand }]}>{c.user.username}</Text>
            <Text style={[styles.commentText, { color: theme.text }]}>{c.text}</Text>
          </View>
          {c.user.id === myUserId && (
            <TouchableOpacity onPress={() => del(c.id)} hitSlop={8}>
              <Text style={{ color: theme.textDim, fontSize: 13 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
      <View style={styles.commentInput}>
        <TextInput
          style={[styles.commentTextInput, { backgroundColor: theme.bg, color: theme.text, borderColor: theme.muted }]}
          placeholder="Kommentar…"
          placeholderTextColor={theme.textDim}
          value={text}
          onChangeText={setText}
          onSubmitEditing={send}
          returnKeyType="send"
          blurOnSubmit={false}
        />
        <TouchableOpacity
          onPress={send}
          disabled={!text.trim() || sending}
          style={[styles.commentSend, { backgroundColor: text.trim() ? theme.brand : theme.muted }]}
        >
          <Text style={{ color: theme.bg, fontWeight: '700', fontSize: 13 }}>▶</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Abend-Zusammenfassung ─────────────────────────────────────────────────────

const ITEMS_ALL = ['hopfen', 'trauben', 'pistole', 'aubergine', 'brokkoli', 'nase', 'burger', 'suesses'];
const ITEM_EMOJI: Record<string, string> = { hopfen:'🌿', trauben:'🍇', pistole:'🔫', aubergine:'🍆', brokkoli:'🥦', nase:'👃', burger:'🍔', suesses:'🍬' };

function AbendSummaryCard({ meta }: { meta: AbendSummaryMeta }) {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const [expanded, setExpanded] = useState<string | null>(null);

  const activeItems = ITEMS_ALL.filter(k => meta.totals.some(p => (p[k as keyof SessionStat] as number) > 0));
  const maxVal = Math.max(1, ...meta.totals.flatMap(p => activeItems.map(k => p[k as keyof SessionStat] as number)));
  const barAreaWidth = width - 80;
  const barWidth = Math.max(20, Math.floor((barAreaWidth / Math.max(activeItems.length, 1) / Math.max(meta.totals.length, 1)) - 4));

  const dateStr = new Date(meta.date).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <View style={[summaryStyles.container, { backgroundColor: theme.bg, borderColor: theme.brand }]}>
      <Text style={[summaryStyles.title, { color: theme.brand }]}>🎉 {meta.abendName || dateStr}</Text>
      <Text style={[summaryStyles.subtitle, { color: theme.textDim }]}>{dateStr}</Text>

      {/* Balkendiagramm */}
      <View style={summaryStyles.chart}>
        {meta.totals.map((person, pi) => (
          <View key={person.userId} style={summaryStyles.personGroup}>
            <Text style={[summaryStyles.personLabel, { color: theme.textDim }]} numberOfLines={1}>{person.username}</Text>
            <View style={summaryStyles.bars}>
              {activeItems.map(k => {
                const val = person[k as keyof SessionStat] as number;
                const barH = val > 0 ? Math.max(4, Math.round((val / maxVal) * 60)) : 2;
                return (
                  <View key={k} style={summaryStyles.barCol}>
                    <Text style={summaryStyles.barVal}>{val > 0 ? val : ''}</Text>
                    <View style={[summaryStyles.bar, { height: barH, backgroundColor: val > 0 ? theme.brand : theme.muted, width: barWidth }]} />
                    <Text style={summaryStyles.barLabel}>{ITEM_EMOJI[k]}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </View>

      {/* Pro Bereich aufklappbar */}
      {meta.perSession.map(ps => (
        <View key={ps.sessionName}>
          <TouchableOpacity style={[summaryStyles.sessionRow, { borderTopColor: theme.muted }]} onPress={() => setExpanded(expanded === ps.sessionName ? null : ps.sessionName)}>
            <Text style={[summaryStyles.sessionName, { color: theme.textDim }]}>{ps.sessionName}</Text>
            <Text style={{ color: theme.textDim }}>{expanded === ps.sessionName ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {expanded === ps.sessionName && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                <View style={{ flexDirection: 'row', paddingVertical: 4 }}>
                  <Text style={[summaryStyles.tableCell, summaryStyles.tableName, { color: theme.textDim, fontWeight: 'bold' }]}>Name</Text>
                  {activeItems.map(k => <Text key={k} style={[summaryStyles.tableCell, { color: theme.textDim, fontWeight: 'bold' }]}>{ITEM_EMOJI[k]}</Text>)}
                </View>
                {ps.stats.map((p, idx) => (
                  <View key={p.userId} style={[{ flexDirection: 'row', paddingVertical: 4 }, idx % 2 === 0 && { backgroundColor: theme.panel }]}>
                    <Text style={[summaryStyles.tableCell, summaryStyles.tableName, { color: theme.text }]}>{p.username}</Text>
                    {activeItems.map(k => <Text key={k} style={[summaryStyles.tableCell, { color: theme.text }]}>{p[k as keyof SessionStat] as number}</Text>)}
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
        </View>
      ))}
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  container:    { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 8 },
  title:        { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  subtitle:     { fontSize: 12, marginBottom: 12 },
  chart:        { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  personGroup:  { alignItems: 'center' },
  personLabel:  { fontSize: 11, marginBottom: 4, maxWidth: 60 },
  bars:         { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  barCol:       { alignItems: 'center', justifyContent: 'flex-end' },
  barVal:       { fontSize: 9, marginBottom: 1 },
  bar:          { borderRadius: 2 },
  barLabel:     { fontSize: 11, marginTop: 2 },
  sessionRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, marginTop: 4 },
  sessionName:  { fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  tableCell:    { width: 44, textAlign: 'center', fontSize: 13 },
  tableName:    { width: 80, textAlign: 'left' },
});

// ── Post-Karte ────────────────────────────────────────────────────────────────

function GroupPostCard({ post, groupId, myUserId, onDelete }: {
  post: GroupPost; groupId: number; myUserId: number; onDelete: (id: number) => void;
}) {
  const { theme } = useTheme();
  const [myReaction, setMyReaction] = useState<string | null>(null);
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({});
  const [showComments, setShowComments] = useState(false);

  async function react(emoji: string) {
    try {
      const result: any = await groupsApi.react(groupId, post.id, emoji);
      if (result?.counts) setReactionCounts(result.counts);
      if (result?.myReaction !== undefined) setMyReaction(result.myReaction);
    } catch {}
  }

  async function handleDelete() {
    try {
      await groupsApi.deletePost(groupId, post.id);
      onDelete(post.id);
    } catch {}
  }

  const imgUrl = post.imageUrl ? `${BASE_URL}${post.imageUrl}` : null;

  return (
    <View style={[styles.card, { backgroundColor: theme.panel }]}>
      <View style={styles.cardHeader}>
        <Avatar user={post.user} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[styles.cardUsername, { color: theme.text }]}>{post.user.username}</Text>
          <Text style={[styles.cardTime, { color: theme.textDim }]}>{formatTime(post.createdAt)}</Text>
        </View>
        {post.user.id === myUserId && (
          <TouchableOpacity onPress={handleDelete} hitSlop={8}>
            <Text style={{ color: theme.textDim, fontSize: 18 }}>⋯</Text>
          </TouchableOpacity>
        )}
      </View>

      {!!post.content && (
        <Text style={[styles.cardContent, { color: theme.text }]}>{post.content}</Text>
      )}

      {post.metadata?.type === 'abend_summary' && (
        <AbendSummaryCard meta={post.metadata} />
      )}

      {imgUrl && (
        <Image source={{ uri: imgUrl }} style={styles.cardImage} resizeMode="cover" />
      )}

      {/* Reaktionen */}
      <View style={styles.reactionBar}>
        {GROUP_REACTIONS.map((emoji) => {
          const count = reactionCounts[emoji] ?? 0;
          const active = myReaction === emoji;
          return (
            <TouchableOpacity
              key={emoji}
              onPress={() => react(emoji)}
              style={[styles.reactionBtn, active && { backgroundColor: theme.brand + '33', borderColor: theme.brand, borderWidth: 1 }]}
            >
              <Text style={styles.reactionEmoji}>{emoji}</Text>
              {count > 0 && <Text style={[styles.reactionCount, { color: active ? theme.brand : theme.textDim }]}>{count}</Text>}
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity onPress={() => setShowComments((v) => !v)} style={styles.commentToggle}>
        <Text style={[styles.commentToggleText, { color: theme.textDim }]}>
          {showComments ? 'Kommentare ausblenden' : 'Kommentare anzeigen'}
        </Text>
      </TouchableOpacity>

      {showComments && <GroupCommentSection groupId={groupId} postId={post.id} myUserId={myUserId} />}
    </View>
  );
}

// ── Hauptscreen ───────────────────────────────────────────────────────────────

export default function GroupDetailScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; name: string }>();
  const groupId = Number(params.id);
  const groupName = params.name ?? '';

  const [posts, setPosts] = useState<GroupPost[]>([]);
  const [rooms, setRooms] = useState<GroupRoom[]>([]);
  const [activeRoomKey, setActiveRoomKey] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [myUserId, setMyUserId] = useState(0);
  const [newPostText, setNewPostText] = useState('');
  const [newPostVisible, setNewPostVisible] = useState(false);
  const [posting, setPosting] = useState(false);

  const load = useCallback(async (cursor?: number, roomKey?: string) => {
    try {
      const data = await groupsApi.posts(groupId, cursor, roomKey);
      if (cursor) {
        setPosts((prev) => [...prev, ...data.posts]);
      } else {
        setPosts(data.posts);
      }
      setNextCursor(data.nextCursor);
    } catch {}
    finally { setLoading(false); setRefreshing(false); setLoadingMore(false); }
  }, [groupId]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    getUser().then((u: any) => { if (u?.id) setMyUserId(u.id); });
    groupsApi.rooms(groupId)
      .then((r) => setRooms(r.filter((room) => room.hasPosts)))
      .catch(() => {});
    load(undefined, activeRoomKey);
  }, [load]));

  function selectRoom(key: string | undefined) {
    setActiveRoomKey(key);
    setLoading(true);
    load(undefined, key);
  }

  async function submitPost() {
    if (!newPostText.trim() || posting) return;
    setPosting(true);
    try {
      const post = await groupsApi.createPost(groupId, newPostText.trim());
      setNewPostText('');
      setNewPostVisible(false);
      setPosts((prev) => [post, ...prev]);
    } catch {}
    finally { setPosting(false); }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.panel, borderBottomColor: theme.muted, paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={[styles.backBtn, { color: theme.brand }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>{groupName}</Text>
        <TouchableOpacity onPress={() => setNewPostVisible(true)} hitSlop={12}>
          <Text style={[styles.newBtn, { color: theme.brand }]}>＋</Text>
        </TouchableOpacity>
      </View>

      {/* Room-Selector */}
      {rooms.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.roomBar, { backgroundColor: theme.panel, borderBottomColor: theme.muted }]}
          contentContainerStyle={styles.roomBarContent}
        >
          <TouchableOpacity
            onPress={() => selectRoom(undefined)}
            style={[styles.roomTab, !activeRoomKey && { borderBottomColor: theme.brand, borderBottomWidth: 2 }]}
          >
            <Text style={[styles.roomTabText, { color: !activeRoomKey ? theme.brand : theme.textDim }]}>Alle</Text>
          </TouchableOpacity>
          {rooms.map((room) => (
            <TouchableOpacity
              key={room.key}
              onPress={() => selectRoom(room.key)}
              style={[styles.roomTab, activeRoomKey === room.key && { borderBottomColor: theme.brand, borderBottomWidth: 2 }]}
            >
              <Text style={[styles.roomTabText, { color: activeRoomKey === room.key ? theme.brand : theme.textDim }]}>
                {room.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color={theme.brand} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => String(p.id)}
          renderItem={({ item }) => (
            <GroupPostCard
              post={item}
              groupId={groupId}
              myUserId={myUserId}
              onDelete={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
            />
          )}
          contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: insets.bottom + 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.brand} />}
          onEndReached={() => { if (nextCursor && !loadingMore) { setLoadingMore(true); load(nextCursor); } }}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={theme.brand} style={{ padding: 16 }} /> : null}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: theme.textDim }]}>Noch keine Posts in dieser Gruppe</Text>
            </View>
          }
        />
      )}

      {/* Neuer Post Modal */}
      <Modal visible={newPostVisible} animationType="slide" transparent onRequestClose={() => setNewPostVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: theme.panel, paddingBottom: insets.bottom + 16 }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Neuer Post</Text>
                <TouchableOpacity onPress={() => setNewPostVisible(false)}>
                  <Text style={{ color: theme.textDim, fontSize: 18 }}>✕</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.newPostInput, { color: theme.text, borderColor: theme.muted }]}
                placeholder="Was möchtest du teilen?"
                placeholderTextColor={theme.textDim}
                multiline
                autoFocus
                value={newPostText}
                onChangeText={setNewPostText}
                maxLength={2000}
              />
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: newPostText.trim() && !posting ? theme.brand : theme.muted }]}
                onPress={submitPost}
                disabled={!newPostText.trim() || posting}
              >
                {posting
                  ? <ActivityIndicator color={theme.bg} />
                  : <Text style={{ color: theme.bg, fontWeight: '700', fontSize: 15 }}>Posten</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10 },
  backBtn: { fontSize: 32, lineHeight: 36, fontWeight: '300' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700' },
  newBtn: { fontSize: 28, fontWeight: '300' },

  card: { borderRadius: 14, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  cardUsername: { fontSize: 14, fontWeight: '700' },
  cardTime: { fontSize: 12, marginTop: 1 },
  cardContent: { fontSize: 15, lineHeight: 22, paddingHorizontal: 12, paddingBottom: 10 },
  cardImage: { width: '100%', height: 220 },

  reactionBar: { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 6, gap: 6, flexWrap: 'wrap' },
  reactionBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  reactionEmoji: { fontSize: 16 },
  reactionCount: { fontSize: 12, fontWeight: '600' },

  commentToggle: { paddingHorizontal: 12, paddingVertical: 8 },
  commentToggleText: { fontSize: 12 },
  commentSection: { borderTopWidth: StyleSheet.hairlineWidth, padding: 10, gap: 8 },
  commentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  commentBubble: { flex: 1, borderRadius: 10, padding: 8 },
  commentUser: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
  commentText: { fontSize: 14, lineHeight: 19 },
  commentInput: { flexDirection: 'row', gap: 8, marginTop: 4 },
  commentTextInput: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 6, fontSize: 14 },
  commentSend: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  newPostInput: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, fontSize: 15, minHeight: 100, textAlignVertical: 'top', marginBottom: 14 },
  submitBtn: { borderRadius: 12, padding: 14, alignItems: 'center' },

  roomBar: { borderBottomWidth: StyleSheet.hairlineWidth, flexGrow: 0 },
  roomBarContent: { paddingHorizontal: 12, gap: 4 },
  roomTab: { paddingHorizontal: 14, paddingVertical: 10 },
  roomTabText: { fontSize: 13, fontWeight: '600' },

  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 15 },
});
