import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigationTypes';
import { useAuth } from '../auth';
import {
  adminFetchClients,
  adminFetchServiceRoutes,
  adminCreateServiceRoute,
  AdminClient,
  ServiceRoute,
} from '../api/client';
import ThemedButton from '../components/Button';
import { colors, spacing } from '../theme';
import { showBanner } from '../components/globalBannerBus';
import { truncateText } from '../utils/text';

type Props = NativeStackScreenProps<RootStackParamList, 'ServiceRoutes'>;

export default function ServiceRoutesScreen({ route, navigation }: Props) {
  const { token } = useAuth();
  const showAll = route.params?.mode === 'all';
  const focusRouteId = route.params?.focusRouteId;
  const [serviceRoutes, setServiceRoutes] = useState<ServiceRoute[]>([]);
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [routeName, setRouteName] = useState('');
  const [creatingRoute, setCreatingRoute] = useState(false);
  const unassignedRoutes = serviceRoutes.filter(route => !route.user_id);

  const load = async () => {
    if (!token) return;
    try {
      const [routeRes, clientRes] = await Promise.all([
        adminFetchServiceRoutes(token),
        adminFetchClients(token),
      ]);
      setServiceRoutes(reorderRoutes(routeRes?.routes || []));
      setClients(clientRes?.clients || []);
    } catch (err: any) {
      showBanner({ type: 'error', message: err?.message || 'Unable to load service routes.' });
    }
  };

  useEffect(() => {
    load();
  }, [token]);

  useEffect(() => {
    navigation.setOptions({ title: showAll ? 'All Service Routes' : 'Service Routes' });
  }, [navigation, showAll]);

  const reorderRoutes = (list: ServiceRoute[]) => {
    if (!focusRouteId) return [...list].sort((a, b) => a.name.localeCompare(b.name));
    return [...list].sort((a, b) => {
      if (a.id === focusRouteId) return -1;
      if (b.id === focusRouteId) return 1;
      return a.name.localeCompare(b.name);
    });
  };

  const clientsByRoute = useMemo(() => {
    const map = new Map<number, AdminClient[]>();
    const seen = new Set<string>();
    clients.forEach(client => {
      const key = client.service_route_id || 0;
      const dedupKey = `${key}:${client.name}|${client.address}`;
      if (seen.has(dedupKey)) return;
      seen.add(dedupKey);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(client);
    });
    return map;
  }, [clients]);

  const unassignedClients = clientsByRoute.get(0) || [];

  useEffect(() => {
    if (focusRouteId) {
      setServiceRoutes(prev => reorderRoutes(prev));
    }
  }, [focusRouteId]);

  const createRoute = async () => {
    if (!token) return;
    const trimmed = routeName.trim();
    if (!trimmed) {
      showBanner({ type: 'error', message: 'Route name is required.' });
      return;
    }
    setCreatingRoute(true);
    try {
      const res = await adminCreateServiceRoute(token, { name: trimmed });
      if (res?.route) {
        setServiceRoutes(prev => reorderRoutes([...prev, res.route]));
      }
      setRouteName('');
      showBanner({ type: 'success', message: `${trimmed} created.` });
      await load();
    } catch (err: any) {
      showBanner({ type: 'error', message: err?.message || 'Unable to create service route.' });
    } finally {
      setCreatingRoute(false);
    }
  };

  if (showAll) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>All Service Routes</Text>
          {serviceRoutes.length === 0 ? (
            <Text style={styles.emptyCopy}>No service routes yet.</Text>
          ) : (
            serviceRoutes.map(routeItem => {
              const assignedClients = (clientsByRoute.get(routeItem.id) || []).sort((a, b) => {
                if (a.scheduled_time && b.scheduled_time) return a.scheduled_time.localeCompare(b.scheduled_time);
                if (a.scheduled_time) return -1;
                if (b.scheduled_time) return 1;
                return a.name.localeCompare(b.name);
              });
              return (
                <View key={routeItem.id} style={styles.routeCard}>
                  <Text style={styles.routeName}>{routeItem.name}</Text>
                  <Text style={styles.routeTechLine}>
                    {routeItem.user_name ? `Technician: ${routeItem.user_name}` : 'No technician assigned'}
                  </Text>
                  {assignedClients.length === 0 ? (
                    <Text style={styles.emptyCopy}>No client locations assigned.</Text>
                  ) : (
                    assignedClients.map(client => (
                      <Text key={`${client.id}-${client.name}`} style={styles.clientItem}>
                        • {truncateText(client.name)} — {truncateText(client.address, 36)}
                      </Text>
                    ))
                  )}
                </View>
              );
            })
          )}
        </View>
        {unassignedClients.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.subTitle}>Unassigned Client Locations</Text>
            {unassignedClients.map(client => (
              <Text key={`${client.id}-${client.name}`} style={styles.clientItem}>
                • {truncateText(client.name)} — {truncateText(client.address, 36)}
              </Text>
            ))}
          </View>
        )}
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={styles.container}>
        {!showAll && (
          <View style={styles.card}>
            <Text style={styles.title}>Create Service Route</Text>
            <TextInput
              style={styles.input}
              value={routeName}
              onChangeText={setRouteName}
              placeholder="Route name"
              placeholderTextColor={colors.muted}
              autoCapitalize="words"
            />
            <ThemedButton
              title={creatingRoute ? 'Adding…' : 'Add Service Route'}
              onPress={createRoute}
              disabled={creatingRoute}
            />
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.subTitle}>Unassigned Service Routes</Text>
          {unassignedRoutes.length === 0 ? (
            <Text style={styles.emptyCopy}>All service routes are assigned.</Text>
          ) : (
            <ScrollView
              style={styles.listScroll}
              contentContainerStyle={styles.listScrollContent}
              nestedScrollEnabled
            >
              {unassignedRoutes.map(route => (
                <Pressable
                  key={route.id}
                  style={styles.routeListRow}
                  onPress={() => navigation.navigate('ServiceRoutes', { focusRouteId: route.id })}
                >
                  <Text style={styles.routeListText}>{route.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing(4), gap: spacing(3) },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: spacing(3), borderWidth: 1, borderColor: colors.border, gap: spacing(2) },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  subTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    color: colors.text,
    backgroundColor: colors.card,
  },
  emptyCopy: { color: colors.muted },
  routeCard: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing(2), gap: spacing(1.5) },
  routeTechLine: { color: colors.muted, fontWeight: '600' },
  listScroll: { maxHeight: 260 },
  listScrollContent: { paddingVertical: spacing(1), gap: spacing(1) },
  routeListRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing(1.5), paddingBottom: spacing(1.5) },
  routeListText: { fontWeight: '600', color: colors.text },
  routeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  routeName: { fontSize: 18, fontWeight: '700', color: colors.text },
  dropdown: { borderWidth: 1, borderColor: colors.primary, borderRadius: 999, paddingHorizontal: spacing(2), paddingVertical: spacing(1) },
  dropdownText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  clientItem: { color: colors.text, paddingLeft: spacing(2) },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', padding: spacing(4) },
  modalCard: { width: '100%', maxWidth: 360, backgroundColor: colors.card, borderRadius: 12, padding: spacing(4), gap: spacing(2), borderWidth: 1, borderColor: colors.border },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  modalOption: { paddingVertical: spacing(1.5), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  modalOptionText: { fontSize: 16, color: colors.text, fontWeight: '600' },
  modalOptionSub: { fontSize: 13, color: colors.muted },
});
