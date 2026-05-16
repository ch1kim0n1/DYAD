import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, RefreshControl, Pressable } from 'react-native';
import type { OrchestratorResult } from '@dyad/shared';

/**
 * iOS companion entry point (Dyad_DDD.md "mobile-first" claim).
 *
 * The Mac app is the analytical surface; the phone is a glanceable
 * status surface — Gottman score, last insight, and a button to open
 * the Mac for the full view.
 *
 * Pull-to-refresh hits the engine sidecar on the Mac over the LAN.
 * `EXPO_PUBLIC_DYAD_SIDECAR_URL` should be set to e.g.
 * `http://192.168.x.y:7432` in `.env.local` for development.
 */
const SIDECAR_URL =
  (process.env.EXPO_PUBLIC_DYAD_SIDECAR_URL as string | undefined) ?? 'http://localhost:7432';

export default function Home() {
  const [result, setResult] = useState<OrchestratorResult | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setRefreshing(true);
    setError(null);
    try {
      const r = await fetch(`${SIDECAR_URL}/status`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRefreshing(false);
    }
  }
  useEffect(() => { load(); }, []);

  const gottman = result?.relationship_model?.gottman_status ?? 'unknown';
  const colour = gottman === 'stable' ? '#22c55e'
    : gottman === 'warning' ? '#f59e0b'
    : gottman === 'failing' ? '#ef4444'
    : '#8a8a92';

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor="#5b8def" />}
    >
      <Text style={styles.brand}>DYAD</Text>
      <Text style={styles.subhead}>Glance — pull to refresh</Text>

      <View style={[styles.card, { borderColor: colour }]}>
        <Text style={[styles.badge, { color: colour }]}>● {gottman.toUpperCase()}</Text>
        <Text style={styles.caption}>Gottman status</Text>
      </View>

      {error && (
        <View style={[styles.card, { borderColor: '#ef4444' }]}>
          <Text style={[styles.badge, { color: '#ef4444' }]}>OFFLINE</Text>
          <Text style={styles.caption}>{error}</Text>
        </View>
      )}

      <Pressable
        style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
        onPress={() => { /* future deep-link */ }}
      >
        <Text style={styles.ctaText}>Open Mac app for full view</Text>
      </Pressable>

      <Text style={styles.footnote}>
        Phone uses your Mac as the engine. Make sure the Mac sidecar is running and your phone is
        on the same Wi-Fi.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: '#0a0a0c' },
  container: { padding: 24, gap: 16 },
  brand: { color: '#e8e8ed', fontSize: 28, fontWeight: '700', letterSpacing: 1 },
  subhead: { color: '#8a8a92', fontSize: 14 },
  card: { borderWidth: 1, borderRadius: 14, padding: 20, backgroundColor: '#16161a', marginTop: 12 },
  badge: { fontSize: 22, fontWeight: '600' },
  caption: { color: '#8a8a92', fontSize: 12, marginTop: 6 },
  cta: { backgroundColor: '#5b8def', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 16 },
  ctaText: { color: 'white', fontWeight: '600', fontSize: 16 },
  footnote: { color: '#8a8a92', fontSize: 12, marginTop: 24, lineHeight: 18 },
});
