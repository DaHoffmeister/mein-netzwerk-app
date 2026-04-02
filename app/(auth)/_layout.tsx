// app/(auth)/_layout.tsx
// Layout für den nicht-eingeloggten Bereich (Login, Register, etc.)
//
// Was sind Route Groups? → Die Klammern "(auth)" sind eine Route Group.
// Der Ordnername erscheint NICHT in der URL. Die Datei "(auth)/login.tsx"
// ist also erreichbar als "/login", nicht als "/auth/login".
// Zweck: Dateien logisch gruppieren, ohne die URL zu verändern.
//
// Stack-Navigation: Screens werden übereinander gestapelt.
// Neuer Screen → schiebt sich von rechts rein.
// Zurück → springt zum vorherigen Screen.
// Für den Auth-Bereich deaktivieren wir den Standard-Header (headerShown: false).

import { Stack } from 'expo-router';

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
