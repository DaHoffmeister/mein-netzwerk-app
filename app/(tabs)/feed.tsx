// app/(tabs)/feed.tsx
// Feed — Posts, Reaktionen, Kommentare

import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Modal,
  Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NavLamp from '../../lib/NavLamp';
import { useTheme } from '../../lib/ThemeContext';
import { getUser } from '../../lib/auth';
import {
  postsApi, reactionsApi, commentsApi,
  type Post, type Comment, type ReactionSummary, type ReactionType,
} from '../../lib/api';

const BASE_URL = 'https://net.assozrpg.de';

const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: 'ME_LAIK',                  emoji: '👍', label: 'Like' },
  { type: 'NOOOT',                    emoji: '🙅', label: 'Noot' },
  { type: 'BUS',                      emoji: '🚌', label: 'Bus' },
  { type: 'SLAP',                     emoji: '👋', label: 'Slap' },
  { type: 'TUSS_HOT_ODER_IRRE_ICH_MICH', emoji: '🔥', label: 'Tuss' },
];

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return 'gerade eben';
  if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min.`;
  if (diff < 86400) return `vor ${Math.floor(diff / 3600)} Std.`;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

function getAvatarHue(name: string) {
  return name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ user, size = 40 }: { user: Post['user']; size?: number }) {
  const url = user.avatarUrl ? `${BASE_URL}${user.avatarUrl}` : null;
  const hue = getAvatarHue(user.username);
  return url ? (
    <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  ) : (
    <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2, backgroundColor: `hsl(${hue},45%,38%)` }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>{getInitials(user.username)}</Text>
    </View>
  );
}

// ── Reaktions-Leiste ──────────────────────────────────────────────────────────

function ReactionBar({ postId, myUserId }: { postId: number; myUserId: number }) {
  const { theme } = useTheme();
  const [summary, setSummary] = useState<ReactionSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useFocusEffect(useCallback(() => {
    reactionsApi.summary(postId).then(setSummary).catch(() => {});
  }, [postId]));

  async function toggle(type: ReactionType) {
    if (loading) return;
    setLoading(true);
    try {
      const next = await reactionsApi.react(postId, type);
      setSummary(next);
    } catch {}
    finally { setLoading(false); }
  }

  if (!summary) return null;

  return (
    <View style={styles.reactionBar}>
      {REACTIONS.map(({ type, emoji }) => {
        const count = summary.counts?.[type] ?? 0;
        const active = summary.myReaction === type;
        return (
          <TouchableOpacity
            key={type}
            onPress={() => toggle(type)}
            style={[styles.reactionBtn, active && { backgroundColor: theme.brand + '33', borderColor: theme.brand, borderWidth: 1 }]}
          >
            <Text style={styles.reactionEmoji}>{emoji}</Text>
            {count > 0 && <Text style={[styles.reactionCount, { color: active ? theme.brand : theme.textDim }]}>{count}</Text>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Kommentare ────────────────────────────────────────────────────────────────

function CommentSection({ postId, myUserId }: { postId: number; myUserId: number }) {
  const { theme } = useTheme();
  const [comments, setComments] = useState<Comment[]>([]);
  const [total, setTotal] = useState(0);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  useFocusEffect(useCallback(() => {
    commentsApi.list(postId).then((r) => { setComments(r.comments); setTotal(r.total); }).catch(() => {});
  }, [postId]));

  async function send() {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    setText('');
    try {
      const c = await commentsApi.create(postId, t);
      setComments((prev) => [...prev, c]);
      setTotal((n) => n + 1);
    } catch {}
    finally { setSending(false); }
  }

  async function del(id: number) {
    try {
      await commentsApi.delete(id);
      setComments((prev) => prev.filter((c) => c.id !== id));
      setTotal((n) => n - 1);
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

// ── Post-Karte ────────────────────────────────────────────────────────────────

function PostCard({ post, myUserId, onDelete }: { post: Post; myUserId: number; onDelete: (id: number) => void }) {
  const { theme } = useTheme();
  const [showComments, setShowComments] = useState(false);

  const imgUrl = post.imageUrl ? `${BASE_URL}${post.imageUrl}` : null;
  const isOwn = post.user.id === myUserId;

  async function handleDelete() {
    try {
      await postsApi.delete(post.id);
      onDelete(post.id);
    } catch {}
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.panel }]}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <Avatar user={post.user} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[styles.cardUsername, { color: theme.text }]}>{post.user.username}</Text>
          <Text style={[styles.cardTime, { color: theme.textDim }]}>{formatTime(post.createdAt)}</Text>
        </View>
        {isOwn && (
          <TouchableOpacity onPress={handleDelete} hitSlop={8}>
            <Text style={{ color: theme.textDim, fontSize: 18 }}>⋯</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {!!post.content && (
        <Text style={[styles.cardContent, { color: theme.text }]}>{post.content}</Text>
      )}

      {/* Image */}
      {imgUrl && (
        <Image
          source={{ uri: imgUrl }}
          style={styles.cardImage}
          resizeMode="cover"
        />
      )}

      {/* Reaktionen */}
      <ReactionBar postId={post.id} myUserId={myUserId} />

      {/* Kommentar-Toggle */}
      <TouchableOpacity onPress={() => setShowComments((v) => !v)} style={styles.commentToggle}>
        <Text style={[styles.commentToggleText, { color: theme.textDim }]}>
          {showComments ? 'Kommentare ausblenden' : 'Kommentare anzeigen'}
        </Text>
      </TouchableOpacity>

      {showComments && <CommentSection postId={post.id} myUserId={myUserId} />}
    </View>
  );
}

// ── Neuer Post Modal ──────────────────────────────────────────────────────────

function NewPostModal({ visible, onClose, onCreated }: {
  visible: boolean;
  onClose: () => void;
  onCreated: (post: Post) => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const post = await postsApi.create(text.trim());
      setText('');
      onCreated(post);
      onClose();
    } catch {}
    finally { setBusy(false); }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: theme.panel, paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Neuer Post</Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={{ color: theme.textDim, fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.newPostInput, { color: theme.text, borderColor: theme.muted }]}
              placeholder="Was möchtest du teilen?"
              placeholderTextColor={theme.textDim}
              multiline
              autoFocus
              value={text}
              onChangeText={setText}
              maxLength={2000}
            />
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: text.trim() && !busy ? theme.brand : theme.muted }]}
              onPress={submit}
              disabled={!text.trim() || busy}
            >
              {busy
                ? <ActivityIndicator color={theme.bg} />
                : <Text style={{ color: theme.bg, fontWeight: '700', fontSize: 15 }}>Posten</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Hauptscreen ───────────────────────────────────────────────────────────────

export default function FeedScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [posts, setPosts] = useState<Post[]>([]);
  const [myUserId, setMyUserId] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [newPostVisible, setNewPostVisible] = useState(false);

  const load = useCallback(async (cursor?: number) => {
    try {
      const data = await postsApi.list(cursor);
      if (cursor) {
        setPosts((prev) => [...prev, ...data.posts]);
      } else {
        setPosts(data.posts);
      }
      setNextCursor(data.nextCursor);
    } catch (err) {
      console.error('Feed laden fehlgeschlagen:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    getUser().then((u) => { if (u && typeof u === 'object' && 'id' in u) setMyUserId((u as { id: number }).id); });
    load();
  }, [load]));

  function refresh() {
    setRefreshing(true);
    load();
  }

  function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    load(nextCursor);
  }

  function onDelete(id: number) {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  function onCreated(post: Post) {
    setPosts((prev) => [post, ...prev]);
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.panel, borderBottomColor: theme.muted, paddingTop: insets.top + 8 }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Feed</Text>
        <NavLamp />
        <TouchableOpacity onPress={() => setNewPostVisible(true)} hitSlop={12}>
          <Text style={[styles.newPostBtn, { color: theme.brand }]}>＋</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color={theme.brand} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => String(p.id)}
          renderItem={({ item }) => (
            <PostCard post={item} myUserId={myUserId} onDelete={onDelete} />
          )}
          contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: insets.bottom + 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.brand} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={theme.brand} style={{ padding: 16 }} /> : null}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: theme.textDim }]}>Noch keine Posts</Text>
            </View>
          }
        />
      )}

      <NewPostModal
        visible={newPostVisible}
        onClose={() => setNewPostVisible(false)}
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
  newPostBtn: { fontSize: 28, fontWeight: '300' },

  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700' },

  card: { borderRadius: 14, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  cardUsername: { fontSize: 14, fontWeight: '700' },
  cardTime: { fontSize: 12, marginTop: 1 },
  cardContent: { fontSize: 15, lineHeight: 22, paddingHorizontal: 12, paddingBottom: 10 },
  cardImage: { width: '100%', height: 220 },

  reactionBar: { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 6, gap: 6 },
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

  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 15 },
});
