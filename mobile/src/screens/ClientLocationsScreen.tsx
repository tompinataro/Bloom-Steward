import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, TextInput, StyleSheet, Modal, Pressable, Share } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigationTypes';
import { useAuth } from '../auth';
import { showBanner } from '../components/globalBannerBus';
import { useFocusEffect } from '@react-navigation/native';
import {
  adminCreateClient,
  adminFetchClients,
  adminFetchServiceRoutes,
  adminFetchUsers,
  adminSetClientRoute,
  AdminClient,
  AdminUser,
  ServiceRoute
} from '../api/client';
import ThemedButton from '../components/Button';
import { colors, spacing } from '../theme';
import { truncateText } from '../utils/text';

type Props = NativeStackScreenProps<RootStackParamList, 'ClientLocations'>;

export default function ClientLocationsScreen({ route, navigation }: Props) {
  const { token } = useAuth();
  const showAll = route.params?.mode === 'all';
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [creating, setCreating] = useState(false);

  const [clients, setClients] = useState<AdminClient[]>([]);
  const [serviceRoutes, setServiceRoutes] = useState<ServiceRoute[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pickerClient, setPickerClient] = useState<UniqueClient | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [clientRes, routeRes, userRes] = await Promise.all([
        adminFetchClients(token),
        adminFetchServiceRoutes(token),
        adminFetchUsers(token),
      ]);
      setClients(clientRes?.clients || []);
      setServiceRoutes(routeRes?.routes || []);
      setUsers(userRes?.users || []);
    } catch (err: any) {
      showBanner({ type: 'error', message: err?.message || 'Unable to load clients.' });
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    navigation.setOptions({ title: showAll ? 'All Client Locations' : 'Client Locations' });
  }, [navigation, showAll]);

  const addClient = async () => {
    if (!token) return;
    const trimmedName = name.trim();
    const trimmedAddress = address.trim();
    if (!trimmedName || !trimmedAddress) {
      showBanner({ type: 'error', message: 'Name and address are required.' });
      return;
    }
    setCreating(true);
    try {
      await adminCreateClient(token, {
        name: trimmedName,
        address: trimmedAddress,
        contactName: contactName.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        latitude: latitude ? Number(latitude) : undefined,
        longitude: longitude ? Number(longitude) : undefined,
      });
      showBanner({ type: 'success', message: `Added ${trimmedName}.` });
      setName('');
      setAddress('');
      setContactName('');
      setContactPhone('');
      setLatitude('');
      setLongitude('');
      await load();
    } catch (err: any) {
      showBanner({ type: 'error', message: err?.message || 'Unable to add client.' });
    } finally {
      setCreating(false);
    }
  };

  const assignRoute = async (routeId: number | null) => {
    if (!token || !pickerClient) return;
    try {
      await Promise.all(
        pickerClient.duplicateIds.map(id =>
          adminSetClientRoute(token, { clientId: id, serviceRouteId: routeId })
        )
      );
      await load();
    } catch (err: any) {
      showBanner({ type: 'error', message: err?.message || 'Unable to assign route.' });
    } finally {
      setPickerClient(null);
    }
  };

  const uniqueClients = useUniqueClients(clients);
  const unassignedClients = uniqueClients.filter(client => !client.service_route_id);
  const listToRender = showAll ? uniqueClients : unassignedClients;

  const shareClients = async () => {
    if (!uniqueClients.length) {
      showBanner({ type: 'info', message: 'No client locations to share yet.' });
      return;
    }
    const lines = uniqueClients.map(client => {
      const routeName = client.service_route_name || 'Unassigned';
      return `${client.name}\nRoute: ${routeName}`;
    });
    try {
      await Share.share({
        title: 'Client Locations',
        message: `Client Locations:\n\n${lines.join('\n\n')}`,
      });
    } catch {}
  };
  const unassignClient = async (client: UniqueClient) => {
    if (!token) return;
    try {
      await Promise.all(
        client.duplicateIds.map(id =>
          adminSetClientRoute(token, { clientId: id, serviceRouteId: null })
        )
      );
      showBanner({ type: 'success', message: `${client.name} unassigned.` });
      await load();
    } catch (err: any) {
      showBanner({ type: 'error', message: err?.message || 'Unable to unassign client.' });
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {!showAll && (
        <View style={styles.card}>
          <Text style={styles.title}>Create Client Location</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
          placeholder="Client name"
          placeholderTextColor={colors.muted}
        />
        <TextInput
          style={styles.input}
          value={address}
          onChangeText={setAddress}
          placeholder="Service address"
          placeholderTextColor={colors.muted}
        />
        <TextInput
          style={styles.input}
          value={contactName}
          onChangeText={setContactName}
          placeholder="Primary contact (optional)"
          placeholderTextColor={colors.muted}
        />
        <TextInput
          style={styles.input}
          value={contactPhone}
          onChangeText={setContactPhone}
          placeholder="Contact phone (optional)"
          placeholderTextColor={colors.muted}
          keyboardType="phone-pad"
        />
        <TextInput
          style={styles.input}
          value={latitude}
          onChangeText={setLatitude}
          placeholder="Latitude (optional)"
          placeholderTextColor={colors.muted}
          keyboardType="numeric"
        />
        <TextInput
          style={styles.input}
          value={longitude}
          onChangeText={setLongitude}
          placeholder="Longitude (optional)"
          placeholderTextColor={colors.muted}
          keyboardType="numeric"
        />
        <ThemedButton title={creating ? 'Adding...' : 'Add Client Location'} onPress={addClient} disabled={creating} />
      </View>
      )}
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.subTitle}>{showAll ? 'All Client Locations' : 'Locations Awaiting Assignment'}</Text>
          {showAll && uniqueClients.length ? (
            <Pressable style={styles.shareChip} onPress={shareClients}>
              <Text style={styles.shareChipText}>Email this list</Text>
            </Pressable>
          ) : null}
        </View>
        {showAll && <Text style={styles.instructionText}>(Tap Tech name or Route to reassign either.)</Text>}
          {listToRender.length === 0 ? (
            <Text style={styles.emptyCopy}>
              {showAll ? 'No client locations yet.' : 'No un-assigned client locations at this time.'}
            </Text>
          ) : (
          <ScrollView
            style={showAll ? styles.listScrollFull : styles.listScroll}
            contentContainerStyle={styles.listScrollContent}
            nestedScrollEnabled
          >
            {listToRender.map(client => (
              <View key={`${client.id}-${client.name}`} style={styles.listRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listName}>{truncateText(client.name)}</Text>
                  <Text style={styles.listMeta}>{truncateText(client.address, 42)}</Text>
                  <Text style={styles.listMetaSmall}>{client.contact_name || ''}</Text>
                </View>
                {showAll ? (
                  <View style={styles.routeActions}>
                    <Pressable
                      style={styles.routePill}
                      onPress={() => {
                        if (client.service_route_id) {
                          navigation.navigate('ServiceRoutes', { mode: 'all' });
                        } else {
                          setPickerClient(client);
                        }
                      }}
                    >
                      <Text style={styles.routePillText}>{client.service_route_name || 'Assign route'}</Text>
                    </Pressable>
                    <Pressable style={styles.unassignBtn} onPress={() => client.service_route_id ? unassignClient(client) : setPickerClient(client)}>
                      <Text style={styles.unassignText}>{client.service_route_id ? getTechFirstName(client, serviceRoutes, users) : 'Assign'}</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable style={styles.dropdown} onPress={() => setPickerClient(client)}>
                    <Text style={styles.dropdownText}>
                      {client.service_route_name || 'Assign route'}
                    </Text>
                  </Pressable>
                )}
              </View>
            ))}
          </ScrollView>
        )}
      </View>
      <Modal
        visible={!!pickerClient}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerClient(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Assign {pickerClient?.name ?? 'client'}
            </Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {serviceRoutes.map(route => (
                <Pressable key={route.id} style={styles.modalOption} onPress={() => assignRoute(route.id)}>
                  <Text style={styles.modalOptionText}>{route.name}</Text>
                  <Text style={styles.modalOptionSub}>{route.user_name ? `Tech: ${route.user_name}` : 'Unassigned'}</Text>
                </Pressable>
              ))}
              <Pressable style={styles.modalOption} onPress={() => assignRoute(null)}>
                <Text style={styles.modalOptionText}>Clear assignment</Text>
              </Pressable>
            </ScrollView>
            <ThemedButton title="Cancel" variant="outline" onPress={() => setPickerClient(null)} />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

type UniqueClient = AdminClient & { duplicateIds: number[] };

function getTechFirstName(client: UniqueClient, routes: ServiceRoute[], users: AdminUser[]): string {
  const route = routes.find(r => r.id === client.service_route_id);
  if (!route?.user_id) return 'Unassign';
  const user = users.find(u => u.id === route.user_id);
  if (!user) return 'Unassign';
  const firstName = user.name.split(/\s+/)[0];
  return firstName || 'Unassign';
}

export function useUniqueClients(clients: AdminClient[]): UniqueClient[] {
  return useMemo(() => {
    const seen = new Map<string, UniqueClient>();
    clients.forEach(client => {
      const key = `${client.name}|${client.address}`;
      const existing = seen.get(key);
      if (existing) {
        existing.duplicateIds.push(client.id);
        if (!existing.service_route_name && client.service_route_name) {
          existing.service_route_name = client.service_route_name;
          existing.service_route_id = client.service_route_id;
        }
      } else {
        seen.set(key, { ...client, duplicateIds: [client.id] });
      }
    });
    return Array.from(seen.values());
  }, [clients]);
}

const styles = StyleSheet.create({
  container: { padding: spacing(4), gap: spacing(3) },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: spacing(3), borderWidth: 1, borderColor: colors.border, gap: spacing(2) },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  subTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    color: colors.text,
    backgroundColor: colors.card,
  },
  listRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing(1.5), gap: spacing(0.5), flexDirection: 'row', alignItems: 'center' },
  listName: { fontWeight: '600', color: colors.text },
  listMeta: { color: colors.text },
  listMetaSmall: { color: colors.muted },
  emptyCopy: { color: colors.muted },
  dropdown: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1),
  },
  listScroll: { maxHeight: 320 },
  listScrollFull: { maxHeight: undefined },
  listScrollContent: { paddingVertical: spacing(1), gap: spacing(1) },
  dropdownText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', padding: spacing(4) },
  modalCard: { width: '100%', maxWidth: 360, backgroundColor: colors.card, borderRadius: 12, padding: spacing(4), gap: spacing(2), borderWidth: 1, borderColor: colors.border },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  modalOption: { paddingVertical: spacing(1.5), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  routeActions: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
  routePill: { borderColor: colors.primary, borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing(2), paddingVertical: spacing(0.5), minWidth: 90, alignItems: 'center' },
  routePillText: { color: colors.primary, fontWeight: '600', textAlign: 'center' },
  unassignBtn: { paddingHorizontal: spacing(2), paddingVertical: spacing(1), borderRadius: 10, backgroundColor: colors.text, minWidth: 80, alignItems: 'center' },
  unassignText: { color: '#fff', fontWeight: '700', textAlign: 'center' },
  modalOptionText: { fontSize: 16, color: colors.text, fontWeight: '600' },
  modalOptionSub: { fontSize: 13, color: colors.muted },
  shareChip: { borderWidth: 1, borderColor: colors.primary, borderRadius: 999, paddingHorizontal: spacing(2), paddingVertical: spacing(0.5) },
  shareChipText: { color: colors.primary, fontWeight: '600', fontSize: 12 },
  instructionText: { fontSize: 13, color: colors.muted, fontStyle: 'italic', marginTop: spacing(0.5) },
});
