import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigationTypes';
import { useAuth } from '../auth';
import {
  adminFetchClients,
  adminFetchServiceRoutes,
  adminFetchUsers,
  adminAssignServiceRoute,
  AdminClient,
  AdminUser,
  ServiceRoute,
} from '../api/client';
import ThemedButton from '../components/Button';
import { colors, spacing } from '../theme';
import { showBanner } from '../components/globalBannerBus';

type Props = NativeStackScreenProps<RootStackParamList, 'ServiceRoutes'>;

export default function ServiceRoutesScreen(_props: Props) {
  const { token } = useAuth();
  const [serviceRoutes, setServiceRoutes] = useState<ServiceRoute[]>([]);
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [techUsers, setTechUsers] = useState<AdminUser[]>([]);
  const [pickerRoute, setPickerRoute] = useState<ServiceRoute | null>(null);

  const load = async () => {
    if (!token) return;
    try {
      const [routeRes, clientRes, usersRes] = await Promise.all([
        adminFetchServiceRoutes(token),
        adminFetchClients(token),
        adminFetchUsers(token),
      ]);
      setServiceRoutes(routeRes?.routes || []);
      setClients(clientRes?.clients || []);
      setTechUsers((usersRes?.users || []).filter(u => u.role === 'tech'));
    } catch (err: any) {
      showBanner({ type: 'error', message: err?.message || 'Unable to load service routes.' });
    }
  };

  useEffect(() => {
    load();
  }, [token]);

  const clientsByRoute = useMemo(() => {
    const map = new Map<number, AdminClient[]>();
    clients.forEach(client => {
      const key = client.service_route_id || 0;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(client);
    });
    return map;
  }, [clients]);

  const assignTech = async (userId: number | null) => {
    if (!token || !pickerRoute) return;
    try {
      await adminAssignServiceRoute(token, { routeId: pickerRoute.id, userId });
      await load();
    } catch (err: any) {
      showBanner({ type: 'error', message: err?.message || 'Unable to assign technician.' });
    } finally {
      setPickerRoute(null);
    }
  };

  const presetRoutes = ['North', 'South', 'East', 'West'];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Create Service Route</Text>
          <ThemedButton
            title="Add Service Route"
            onPress={() => showBanner({ type: 'info', message: 'Route creation coming soon.' })}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.subTitle}>Existing Service Routes</Text>
          {presetRoutes.map(route => (
            <View key={route} style={styles.routeListRow}>
              <Text style={styles.routeListText}>{route}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Assign Technicians</Text>
          {serviceRoutes.length === 0 ? (
            <Text style={styles.emptyCopy}>No service routes yet.</Text>
          ) : (
            serviceRoutes.map(route => {
              const assignedClients = clientsByRoute.get(route.id) || [];
              return (
                <View key={route.id} style={styles.routeCard}>
                  <View style={styles.routeHeader}>
                    <Text style={styles.routeName}>{route.name}</Text>
                    <Pressable style={styles.dropdown} onPress={() => setPickerRoute(route)}>
                      <Text style={styles.dropdownText}>{route.user_name || 'Assign tech'}</Text>
                    </Pressable>
                  </View>
                  {assignedClients.length === 0 ? (
                    <Text style={styles.emptyCopy}>No client locations assigned.</Text>
                  ) : (
                    assignedClients.map(client => (
                      <Text key={client.id} style={styles.clientItem}>{client.name}</Text>
                    ))
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <Modal
        visible={!!pickerRoute}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerRoute(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Assign tech to {pickerRoute?.name ?? 'route'}
            </Text>
            <ScrollView style={{ maxHeight: 280 }}>
              {techUsers.length === 0 ? (
                <Text style={styles.emptyCopy}>No field techs yet.</Text>
              ) : (
                techUsers.map(tech => (
                  <Pressable key={tech.id} style={styles.modalOption} onPress={() => assignTech(tech.id)}>
                    <Text style={styles.modalOptionText}>{tech.name}</Text>
                    <Text style={styles.modalOptionSub}>{tech.email}</Text>
                  </Pressable>
                ))
              )}
              <Pressable style={styles.modalOption} onPress={() => assignTech(null)}>
                <Text style={styles.modalOptionText}>Clear assignment</Text>
              </Pressable>
            </ScrollView>
            <ThemedButton title="Cancel" variant="outline" onPress={() => setPickerRoute(null)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing(4), gap: spacing(3) },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: spacing(3), borderWidth: 1, borderColor: colors.border, gap: spacing(2) },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  subTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  routeListRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing(1.5), paddingHorizontal: spacing(2) },
  routeListText: { fontWeight: '600', color: colors.text },
  emptyCopy: { color: colors.muted },
  routeCard: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing(2), gap: spacing(1.5) },
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
