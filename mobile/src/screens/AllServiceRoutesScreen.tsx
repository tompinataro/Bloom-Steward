import React, { useCallback, useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigationTypes';
import { useAuth } from '../auth';
import { adminFetchClients, adminFetchServiceRoutes, AdminClient, ServiceRoute } from '../api/client';
import { showBanner } from '../components/globalBannerBus';
import { colors, spacing } from '../theme';
import { truncateText } from '../utils/text';
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

  const clientsByRoute = routes.reduce<Record<number, AdminClient[]>>((acc, route) => {
    const list = clients.filter(c => c.service_route_id === route.id);
    const dedup = Array.from(
      new Map(list.map(c => [`${c.name}|${c.address}`, c])).values()
    );
    acc[route.id] = dedup;
    return acc;
  }, {});

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>All Service Routes</Text>
        {loading ? (
          <Text style={styles.empty}>Loading…</Text>
        ) : routes.length === 0 ? (
          <Text style={styles.empty}>No service routes yet.</Text>
        ) : (
          routes.map(route => (
            <View key={route.id} style={styles.routeBlock}>
              <View style={styles.routeHeader}>
                <Text style={styles.routeName}>{route.name}</Text>
                <Text style={styles.routeTech}>
                  {route.user_name ? `Tech: ${route.user_name}` : 'Unassigned'}
                </Text>
              </View>
              {(clientsByRoute[route.id] || []).length === 0 ? (
                <Text style={styles.empty}>No client locations assigned.</Text>
              ) : (
                clientsByRoute[route.id].map(client => (
                  <Text key={`${route.id}-${client.id}`} style={styles.clientLine}>
                    • {truncateText(client.name)} — {truncateText(client.address, 32)}
                  </Text>
                ))
              )}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing(4), gap: spacing(3) },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: spacing(3), borderWidth: 1, borderColor: colors.border, gap: spacing(2) },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  empty: { color: colors.muted },
  routeBlock: { paddingTop: spacing(1.5), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, gap: spacing(0.75) },
  routeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  routeName: { fontSize: 18, fontWeight: '700', color: colors.text },
  routeTech: { color: colors.muted },
  clientLine: { color: colors.text, paddingLeft: spacing(1) },
});
