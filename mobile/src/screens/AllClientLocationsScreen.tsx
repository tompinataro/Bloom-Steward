import React, { useCallback, useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigationTypes';
import { useAuth } from '../auth';
import { adminFetchClients, AdminClient } from '../api/client';
import { showBanner } from '../components/globalBannerBus';
import { colors, spacing } from '../theme';
import { useFocusEffect } from '@react-navigation/native';

type Props = NativeStackScreenProps<RootStackParamList, 'AllClientLocations'>;

export default function AllClientLocationsScreen(_props: Props) {
  const { token } = useAuth();
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await adminFetchClients(token);
      setClients(res?.clients || []);
    } catch (err: any) {
      showBanner({ type: 'error', message: err?.message || 'Unable to load client locations.' });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const uniqueClients = dedupeClients(clients);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {loading ? (
        <Text style={styles.emptyCopy}>Loading…</Text>
      ) : uniqueClients.length === 0 ? (
        <Text style={styles.emptyCopy}>No client locations yet.</Text>
      ) : (
        uniqueClients.map(client => (
          <View key={`${client.id}-${client.name}`} style={styles.row}>
            <Text style={styles.name}>{client.name}</Text>
            <Text style={styles.meta}>{client.address}</Text>
            {client.service_route_name ? (
              <Text style={styles.metaSmall}>Route: {client.service_route_name}</Text>
            ) : (
              <Text style={styles.metaSmall}>Unassigned</Text>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

function dedupeClients(clients: AdminClient[]): AdminClient[] {
  const seen = new Map<string, AdminClient>();
  clients.forEach(client => {
    const key = `${client.name}|${client.address}`;
    if (!seen.has(key)) {
      seen.set(key, client);
    }
  });
  return Array.from(seen.values());
}

const styles = StyleSheet.create({
  container: { padding: spacing(4), gap: spacing(2) },
  row: {
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: spacing(3),
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing(0.5),
  },
  name: { fontSize: 18, fontWeight: '700', color: colors.text },
  meta: { color: colors.text, fontSize: 15 },
  metaSmall: { color: colors.muted, fontSize: 14 },
  emptyCopy: { color: colors.muted, textAlign: 'center', marginTop: spacing(6) },
});
