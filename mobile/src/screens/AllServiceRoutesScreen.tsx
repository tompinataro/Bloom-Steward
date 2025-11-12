import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigationTypes';
import { useAuth } from '../auth';
import {
  adminFetchClients,
  adminFetchServiceRoutes,
  AdminClient,
  ServiceRoute,
} from '../api/client';
import { colors, spacing } from '../theme';
import { showBanner } from '../components/globalBannerBus';
import { useFocusEffect } from '@react-navigation/native';

type Props = NativeStackScreenProps<RootStackParamList, 'AllServiceRoutes'>;

export default function AllServiceRoutesScreen(_props: Props) {
  const { token } = useAuth();
  const [routes, setRoutes] = useState<ServiceRoute[]>([]);
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [routeRes, clientRes] = await Promise.all([
        adminFetchServiceRoutes(token),
        adminFetchClients(token),
      ]);
      setRoutes(routeRes?.routes || []);
      setClients(clientRes?.clients || []);
    } catch (err: any) {
      showBanner({ type: 'error', message: err?.message || 'Unable to load service routes.' });
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
  const clientsByRoute = useMemo(() => {
    const map = new Map<number | null, typeof uniqueClients>();
    uniqueClients.forEach(client => {
      const key = client.service_route_id || null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(client);
    });
    return map;
  }, [uniqueClients]);

  const unassigned = clientsByRoute.get(null) || [];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {loading ? (
        <Text style={styles.emptyCopy}>Loading…</Text>
      ) : routes.length === 0 ? (
        <Text style={styles.emptyCopy}>No service routes yet.</Text>
      ) : (
        routes.map(route => {
          const items = clientsByRoute.get(route.id) || [];
          return (
            <View key={route.id} style={styles.card}>
              <Text style={styles.title}>{route.name}</Text>
              <Text style={styles.meta}>{route.user_name ? `Technician: ${route.user_name}` : 'Unassigned technician'}</Text>
              {items.length === 0 ? (
                <Text style={styles.emptyCopy}>No client locations assigned.</Text>
              ) : (
                items.map(client => (
                  <Text key={`${client.id}-${client.name}`} style={styles.clientItem}>
                    • {client.name} — {client.address}
                  </Text>
                ))
              )}
            </View>
          );
        })
      )}
      {unassigned.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.title}>Unassigned Client Locations</Text>
          {unassigned.map(client => (
            <Text key={`${client.id}-${client.name}`} style={styles.clientItem}>
              • {client.name} — {client.address}
            </Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing(4), gap: spacing(3) },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing(3),
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing(1),
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  meta: { color: colors.muted, fontWeight: '600' },
  clientItem: { color: colors.text, fontSize: 15, paddingLeft: spacing(1) },
  emptyCopy: { color: colors.muted, fontStyle: 'italic' },
});

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
