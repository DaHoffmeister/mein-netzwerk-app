// lib/api.ts
// Zentraler HTTP-Client für alle API-Calls gegen das Backend.
// Hängt vor jedem Request automatisch den JWT als Bearer-Token an.

import axios from 'axios';
import { Platform } from 'react-native';
import { getToken } from './auth';

const api = axios.create({
  baseURL: 'https://net.assozrpg.de/api',
  withCredentials: Platform.OS === 'web',
});

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Abend ─────────────────────────────────────────────────────────────────────

export type AbendSession = {
  id: number;
  name: string;
  code: string;
  active: boolean;
  participants: { user: { id: number; username: string; avatarUrl: string | null } }[];
};

export type Abend = {
  id: number;
  date: string;
  name: string | null;
  active: boolean;
  createdById: number;
  sessions: AbendSession[];
};

export const abendApi = {
  create: (sessionName: string, participantIds: number[], name?: string) =>
    api.post('/counter/abend', { sessionName, participantIds, name }).then(r => r.data) as Promise<Abend>,

  active: () =>
    api.get('/counter/abend/active').then(r => r.data) as Promise<Abend | null>,

  addSession: (abendId: number, name: string, participantIds: number[]) =>
    api.post(`/counter/abend/${abendId}/sessions`, { name, participantIds }).then(r => r.data) as Promise<AbendSession>,

  end: (abendId: number) =>
    api.post(`/counter/abend/${abendId}/end`).then(r => r.data),

  stats: (abendId: number) =>
    api.get(`/counter/abend/${abendId}/stats`).then(r => r.data) as Promise<{
      totals: SessionStat[];
      perSession: { sessionId: number; sessionName: string; stats: SessionStat[] }[];
    }>,
};

export type SessionStat = {
  userId: number;
  username: string;
  avatarUrl: string | null;
  Bier: number; Wein: number; Shot: number;
  Cocktail: number; Joint: number; Line: number;
};

// ── Messenger ────────────────────────────────────────────────────────────────

export const messenger = {
  conversations: () =>
    api.get('/messenger/conversations').then((r) => r.data),

  messages: (convId: number, before?: string) =>
    api.get(`/messenger/conversations/${convId}/messages`, {
      params: { limit: 50, ...(before ? { before } : {}) },
    }).then((r) => r.data),

  send: (convId: number, body: Record<string, unknown>) =>
    api.post(`/messenger/conversations/${convId}/messages`, body).then((r) => r.data),

  markRead: (convId: number) =>
    api.post(`/messenger/conversations/${convId}/read`).then((r) => r.data),

  createDM: (targetUserId: number) =>
    api.post('/messenger/conversations', { targetUserId }).then((r) => r.data),

  setGroupKeys: (convId: number, keys: { userId: number; encryptedKey: string }[]) =>
    api.put(`/messenger/conversations/${convId}/group-keys`, { keys }).then((r) => r.data),
};

// ── Feed ─────────────────────────────────────────────────────────────────────

export const postsApi = {
  list: (cursor?: number) =>
    api.get('/posts', { params: { limit: 20, ...(cursor ? { cursor } : {}) } })
      .then((r) => r.data) as Promise<{ posts: Post[]; nextCursor: number | null }>,

  create: (content: string) =>
    api.post('/posts', { content }).then((r) => r.data) as Promise<Post>,

  delete: (id: number) =>
    api.delete(`/posts/${id}`).then((r) => r.data),
};

export const reactionsApi = {
  summary: (postId: number) =>
    api.get(`/reactions/${postId}/summary`).then((r) => r.data) as Promise<ReactionSummary>,

  react: (postId: number, type: ReactionType) =>
    api.post(`/reactions/${postId}`, { type }).then((r) => r.data) as Promise<ReactionSummary>,
};

export const commentsApi = {
  list: (postId: number, offset = 0) =>
    api.get(`/comments/${postId}`, { params: { limit: 20, offset } })
      .then((r) => r.data) as Promise<{ comments: Comment[]; total: number }>,

  create: (postId: number, text: string) =>
    api.post('/comments', { postId, text }).then((r) => r.data) as Promise<Comment>,

  delete: (commentId: number) =>
    api.delete(`/comments/${commentId}`).then((r) => r.data),
};

// ── Shared Types ──────────────────────────────────────────────────────────────

export type ReactionType = 'ME_LAIK' | 'NOOOT' | 'BUS' | 'SLAP' | 'TUSS_HOT_ODER_IRRE_ICH_MICH';

export type ReactionSummary = {
  counts: Record<ReactionType, number>;
  myReaction: ReactionType | null;
};

export type Post = {
  id: number;
  content: string;
  imageUrl: string | null;
  createdAt: string;
  user: { id: number; username: string; avatarUrl: string | null };
  _count?: { comments: number };
};

export type Comment = {
  id: number;
  text: string;
  createdAt: string;
  user: { id: number; username: string; avatarUrl: string | null };
};

// ── Gruppen ───────────────────────────────────────────────────────────────────

export type Group = {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  memberCount: number;
  postCount: number;
  myRole: 'ADMIN' | 'MEMBER' | null;
  createdBy: { id: number; username: string };
};

export type AbendSummaryMeta = {
  type: 'abend_summary';
  abendName: string | null;
  date: string;
  totals: SessionStat[];
  perSession: { sessionName: string; stats: SessionStat[] }[];
};

export type GroupPost = {
  id: number;
  content: string;
  imageUrl: string | null;
  metadata: AbendSummaryMeta | null;
  createdAt: string;
  user: { id: number; username: string; avatarUrl: string | null };
};

export const groupsApi = {
  list: () =>
    api.get('/groups').then((r) => r.data) as Promise<Group[]>,

  get: (id: number) =>
    api.get(`/groups/${id}`).then((r) => r.data) as Promise<Group & { myRole: string | null }>,

  create: (name: string, description: string) =>
    api.post('/groups', { name, description }).then((r) => r.data) as Promise<Group>,

  join: (id: number) =>
    api.post(`/groups/${id}/join`).then((r) => r.data),

  leave: (id: number) =>
    api.delete(`/groups/${id}/leave`).then((r) => r.data),

  posts: (id: number, cursor?: number, roomKey?: string) =>
    api.get(`/groups/${id}/posts`, { params: { limit: 20, ...(cursor ? { cursor } : {}), ...(roomKey ? { roomKey } : {}) } })
      .then((r) => r.data) as Promise<{ posts: GroupPost[]; nextCursor: number | null }>,

  createPost: (id: number, content: string) =>
    api.post(`/groups/${id}/posts`, { content }).then((r) => r.data) as Promise<GroupPost>,

  deletePost: (groupId: number, postId: number) =>
    api.delete(`/groups/${groupId}/posts/${postId}`).then((r) => r.data),

  react: (groupId: number, postId: number, emoji: string) =>
    api.post(`/groups/${groupId}/posts/${postId}/react`, { emoji }).then((r) => r.data),

  comments: (groupId: number, postId: number) =>
    api.get(`/groups/${groupId}/posts/${postId}/comments`).then((r) => r.data) as Promise<{ comments: Comment[]; total: number }>,

  createComment: (groupId: number, postId: number, text: string) =>
    api.post(`/groups/${groupId}/posts/${postId}/comments`, { text }).then((r) => r.data) as Promise<Comment>,

  deleteComment: (groupId: number, postId: number, commentId: number) =>
    api.delete(`/groups/${groupId}/posts/${postId}/comments/${commentId}`).then((r) => r.data),

  rooms: (id: number) =>
    api.get(`/groups/${id}/rooms`).then((r) => r.data) as Promise<GroupRoom[]>,
};

export type GroupRoom = {
  id: number;
  key: string;
  name: string;
  description: string | null;
  hasPosts: boolean;
  hasResources: boolean;
  hasUploads: boolean;
  hasVideos: boolean;
  hasQuests: boolean;
};

// ── Events ────────────────────────────────────────────────────────────────────

export type Event = {
  id: number;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  location: string | null;
  isPrivate: boolean;
  createdBy: { id: number; username: string };
  myRsvp: 'GOING' | 'MAYBE' | 'NOT_GOING' | null;
  rsvpCounts: { GOING: number; MAYBE: number; NOT_GOING: number };
  _count: { rsvps: number; comments: number };
};

export const eventsApi = {
  upcoming: (n = 20) =>
    api.get('/events', { params: { upcoming: n } }).then((r) => r.data) as Promise<Event[]>,

  create: (data: { title: string; description?: string; startTime: string; endTime: string; location?: string }) =>
    api.post('/events', data).then((r) => r.data) as Promise<Event>,

  rsvp: (id: number, status: 'GOING' | 'MAYBE' | 'NOT_GOING') =>
    api.post(`/events/${id}/rsvp`, { status }).then((r) => r.data) as Promise<{ rsvpCounts: Event['rsvpCounts']; myRsvp: Event['myRsvp'] }>,
};

// ── Profil ────────────────────────────────────────────────────────────────────

export type UserProfile = {
  id: number;
  username: string;
  email?: string;
  bio: string | null;
  avatarUrl: string | null;
  location?: string | null;
  createdAt: string;
  groups: { id: number; name: string }[];
  posts: { id: number; content: string; createdAt: string; imageUrl: string | null }[];
};

export const profileApi = {
  me: () =>
    api.get('/users/me').then((r) => r.data) as Promise<UserProfile>,

  updateBio: (bio: string) =>
    api.put('/users/me', { bio }).then((r) => r.data),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.put('/users/me/password', { currentPassword, newPassword }).then((r) => r.data),
};

// ── User-Suche ───────────────────────────────────────────────────────────────

export const usersApi = {
  all: () =>
    api.get('/users').then((r) => r.data) as Promise<{ id: number; username: string }[]>,
};

// ── E2E Key-Verwaltung ───────────────────────────────────────────────────────

export const e2eApi = {
  uploadPublicKey: (publicKey: string) =>
    api.put('/users/me/public-key', { publicKey }).then((r) => r.data),

  getPublicKey: (userId: number) =>
    api.get(`/users/${userId}/public-key`).then((r) => r.data) as Promise<{ publicKey: string }>,

  getKeyBackup: () =>
    api.get('/users/me/key-backup').then((r) => r.data) as Promise<{
      hasBackup: boolean;
      encryptedPrivateKey?: string;
      iv?: string;
      salt?: string;
    }>,

  uploadKeyBackup: (encryptedPrivateKey: string, iv: string, salt: string) =>
    api.put('/users/me/key-backup', { encryptedPrivateKey, iv, salt }).then((r) => r.data),
};

export default api;
