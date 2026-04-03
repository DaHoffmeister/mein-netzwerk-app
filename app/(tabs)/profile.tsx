// app/(tabs)/profile.tsx
// Profil-Screen mit Theme-Auswahl

import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../lib/ThemeContext';
import { THEMES } from '../../lib/themes';
import { deleteToken, deleteUser } from '../../lib/auth';
import api from '../../lib/api';

export default function ProfileScreen() {
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  async function handleLogout() {
    await api.post('/auth/logout').catch(() => {});
    await deleteToken();
    await deleteUser();
    router.replace('/(auth)/login');
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.bg }]}>
      <Text style={[styles.sectionTitle, { color: theme.textDim }]}>DESIGN</Text>

      <View style={[styles.card, { backgroundColor: theme.panel }]}>
        {THEMES.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[
              styles.themeRow,
              { borderBottomColor: theme.muted },
              t.key === theme.key && { backgroundColor: theme.muted },
            ]}
            onPress={() => setTheme(t.key)}
          >
            <Text style={styles.themeEmoji}>{t.emoji}</Text>
            <Text style={[styles.themeLabel, { color: theme.text }]}>{t.label}</Text>
            {t.key === theme.key && (
              <Text style={[styles.checkmark, { color: theme.brand }]}>✓</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Vorschau */}
      <Text style={[styles.sectionTitle, { color: theme.textDim }]}>VORSCHAU</Text>
      <View style={[styles.card, { backgroundColor: theme.panel }]}>
        <Text style={[styles.previewTitle, { color: theme.brand }]}>
          {theme.emoji} {theme.label}
        </Text>
        <Text style={[styles.previewText, { color: theme.text }]}>
          Das ist ein Beispieltext im gewählten Theme.
        </Text>
        <Text style={[styles.previewDim, { color: theme.textDim }]}>
          Gedämpfter Text, z.B. für Timestamps
        </Text>
        <View style={styles.previewButtons}>
          <View style={[styles.previewBtn, { backgroundColor: theme.brand }]}>
            <Text style={{ color: theme.bg, fontWeight: 'bold' }}>Primary</Text>
          </View>
          <View style={[styles.previewBtn, { backgroundColor: theme.accent }]}>
            <Text style={{ color: theme.text, fontWeight: 'bold' }}>Accent</Text>
          </View>
          <View style={[styles.previewBtn, { backgroundColor: theme.danger }]}>
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Danger</Text>
          </View>
        </View>
      </View>
      <Text style={[styles.sectionTitle, { color: theme.textDim }]}>ACCOUNT</Text>
      <View style={[styles.card, { backgroundColor: theme.panel }]}>
        <TouchableOpacity style={[styles.themeRow, { borderBottomWidth: 0 }]} onPress={handleLogout}>
          <Text style={[styles.themeLabel, { color: theme.danger }]}>Ausloggen</Text>
        </TouchableOpacity>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginLeft: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  card: {
    marginHorizontal: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
  },
  themeEmoji: { fontSize: 22, marginRight: 12 },
  themeLabel: { flex: 1, fontSize: 16 },
  checkmark: { fontSize: 18, fontWeight: 'bold' },

  previewTitle: { fontSize: 20, fontWeight: 'bold', padding: 16, paddingBottom: 8 },
  previewText: { fontSize: 15, paddingHorizontal: 16, paddingBottom: 6 },
  previewDim: { fontSize: 13, paddingHorizontal: 16, paddingBottom: 12 },
  previewButtons: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    paddingTop: 4,
  },
  previewBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
});
