import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, TextInput, StyleSheet, Modal, Pressable, Share, FlatList, Linking } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigationTypes';
import { useAuth } from '../auth';
import { showBanner } from '../components/globalBannerBus';
import { useFocusEffect } from '@react-navigation/native';
import {
  adminCreateClient,
  adminFetchClients,
  adminFetchServiceRoutes,
  adminSetClientRoute,
  AdminClient,
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
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [zip, setZip] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [creating, setCreating] = useState(false);

  const [clients, setClients] = useState<AdminClient[]>([]);
  const [serviceRoutes, setServiceRoutes] = useState<ServiceRoute[]>([]);
  const [pickerClient, setPickerClient] = useState<UniqueClient | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [clientRes, routeRes] = await Promise.all([
        adminFetchClients(token),
        adminFetchServiceRoutes(token),
      ]);
      setClients(clientRes?.clients || []);
      setServiceRoutes(routeRes?.routes || []);
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

  const uniqueClients = useUniqueClients(clients);
  const unassignedClients = uniqueClients.filter(client => !client.service_route_id);
  const listToRender = showAll ? uniqueClients : unassignedClients;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: showAll && uniqueClients.length
        ? () => (
            <Pressable style={styles.headerChip} onPress={shareClients}>
              <Text style={styles.headerChipText}>Email List</Text>
            </Pressable>
          )
        : undefined,
    });
  }, [navigation, showAll, uniqueClients.length]);

  const buildFullAddress = (streetRaw: string, cityRaw: string, stateRaw: string, zipRaw: string) => {
    const street = streetRaw.trim();
    const cityPart = cityRaw.trim();
    const statePart = stateRaw.trim();
    const zipPart = zipRaw.trim();
    let line2 = '';
    if (cityPart) {
      line2 += cityPart;
    }
    if (statePart) {
      line2 += line2 ? `, ${statePart}` : statePart;
    }
    if (zipPart) {
      line2 += line2 ? ` ${zipPart}` : zipPart;
    }
    return line2 ? `${street}, ${line2}` : street;
  };

  const addClient = async () => {
    if (!token) return;
    const trimmedName = name.trim();
    const trimmedAddress = address.trim();
    if (!trimmedName || !trimmedAddress) {
      showBanner({ type: 'error', message: 'Name and address are required.' });
      return;
    }
    const trimmedCity = city.trim();
    const trimmedRegion = region.trim();
    const trimmedZip = zip.trim();
    const fullAddress = buildFullAddress(trimmedAddress, trimmedCity, trimmedRegion, trimmedZip);
    setCreating(true);
    try {
      await adminCreateClient(token, {
        name: trimmedName,
        address: fullAddress,
        city: trimmedCity || undefined,
        state: trimmedRegion || undefined,
        zip: trimmedZip || undefined,
        contactName: contactName.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        latitude: latitude ? Number(latitude) : undefined,
        longitude: longitude ? Number(longitude) : undefined,
      });
      showBanner({ type: 'success', message: `Added ${trimmedName}.` });
      setName('');
      setAddress('');
      setCity('');
      setRegion('');
      setZip('');
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
      showBanner({ type: 'error', message: err?.message || 'Unable to place client in route.' });
    } finally {
      setPickerClient(null);
    }
  };

  const shareClients = async () => {
    if (!uniqueClients.length) {
      showBanner({ type: 'info', message: 'No client locations to share yet.' });
      return;
    }
    const lines = uniqueClients.map(client => {
      const routeName = client.service_route_name || 'Unassigned';
      return `${client.name}\nRoute: ${routeName}`;
    });
    const subject = 'Client Locations';
    const body = `Client Locations:\n\n${lines.join('\n\n')}`;
    const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    try {
      const canMail = await Linking.canOpenURL(mailto);
      if (canMail) {
        await Linking.openURL(mailto);
        return;
      }
      await Share.share({
        title: subject,
        message: body,
      });
    } catch {}
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
    >
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
            value={city}
            onChangeText={setCity}
            placeholder="City"
            placeholderTextColor={colors.muted}
          />
          <TextInput
            style={styles.input}
            value={region}
            onChangeText={setRegion}
            placeholder="State"
            placeholderTextColor={colors.muted}
            autoCapitalize="characters"
          />
          <TextInput
            style={styles.input}
            value={zip}
            onChangeText={setZip}
            placeholder="Zip"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
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
        {!showAll && (
          <View style={[styles.cardHeader, styles.cardHeaderCentered]}>
            <Text style={styles.subTitle}>Locations Awaiting Placement</Text>
          </View>
        )}
        {listToRender.length === 0 ? (
          <Text style={styles.emptyCopy}>
            {showAll ? 'No client locations yet.' : 'No unplaced client locations at this time.'}
          </Text>
        ) : (
          <View style={showAll ? styles.listScrollFull : styles.listScroll}>
            {listToRender.map(client => (
              <View key={`${client.id}-${client.name}`} style={styles.listRow}>
                <View style={styles.listMain}>
                  <Text style={styles.listName} numberOfLines={1} ellipsizeMode="tail">{truncateText(client.name, 30)}</Text>
                  <Text style={styles.listMeta} numberOfLines={1} ellipsizeMode="tail">{truncateText(client.address, 17)}</Text>
                </View>
                {showAll ? (
                  <View style={styles.routeActions}>
                    <Pressable
                      style={[
                        styles.routePill,
                        !client.service_route_name ? styles.routePillUnassigned : null,
                      ]}
                      onPress={() => {
                        if (client.service_route_id) {
                          navigation.navigate('ServiceRoutes', { mode: 'all' });
                        } else {
                          setPickerClient(client);
                        }
                      }}
                    >
                      <Text
                        style={[
                          styles.routePillText,
                          !client.service_route_name ? styles.routePillTextUnassigned : null,
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {client.service_route_name || 'Place in route'}
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable style={styles.dropdown} onPress={() => setPickerClient(client)}>
                    <Text style={styles.dropdownText} numberOfLines={1} ellipsizeMode="tail">
                      {client.service_route_name || 'Place in route'}
                    </Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
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
              Place {pickerClient?.name ?? 'client'}
            </Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {serviceRoutes.map(route => (
                <Pressable key={route.id} style={styles.modalOption} onPress={() => assignRoute(route.id)}>
                  <Text style={styles.modalOptionText}>{route.name}</Text>
                  <Text style={styles.modalOptionSub}>{route.user_name ? `Tech: ${route.user_name}` : 'Unassigned'}</Text>
                </Pressable>
              ))}
              <Pressable style={styles.modalOption} onPress={() => assignRoute(null)}>
                <Text style={styles.modalOptionText}>Remove from route</Text>
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
    // Sort alphabetically by client name
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [clients]);
}

const styles = StyleSheet.create({
  container: { padding: spacing(3), gap: spacing(2.5) },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: spacing(2), borderWidth: 1, borderColor: colors.border, gap: spacing(1.5) },
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
  listRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing(1.5), gap: spacing(0.75), flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', justifyContent: 'space-between' },
  listMain: { flexGrow: 1, flexShrink: 1, minWidth: 0, maxWidth: '60%', gap: spacing(0.25) },
  listName: { fontWeight: '600', color: colors.text },
  listMeta: { color: colors.text },
  emptyCopy: { color: colors.muted },
  dropdown: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1),
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexShrink: 1,
  },
  listScroll: { width: '100%' },
  listScrollFull: { width: '100%' },
  listScrollContent: { paddingVertical: spacing(1), gap: spacing(1) },
  dropdownText: { color: colors.primary, fontWeight: '600', fontSize: 13, flexShrink: 1 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', padding: spacing(4) },
  modalCard: { width: '100%', maxWidth: 360, backgroundColor: colors.card, borderRadius: 12, padding: spacing(4), gap: spacing(2), borderWidth: 1, borderColor: colors.border },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  modalOption: { paddingVertical: spacing(1.5), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  routeActions: { flexGrow: 0, flexShrink: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing(1) },
  routePill: { borderColor: colors.primary, borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing(2), paddingVertical: spacing(0.5), minWidth: 88, alignItems: 'center', flexShrink: 1, maxWidth: 120 },
  routePillUnassigned: { backgroundColor: colors.primary, borderColor: colors.primary },
  routePillText: { color: colors.primary, fontWeight: '600', textAlign: 'center', flexShrink: 1, fontSize: 13 },
  routePillTextUnassigned: { color: colors.card, fontSize: 11 },
  modalOptionText: { fontSize: 16, color: colors.text, fontWeight: '600' },
  modalOptionSub: { fontSize: 13, color: colors.muted },
  cardHeader: { flexDirection: 'row', gap: spacing(2), width: '100%' },
  cardHeaderCentered: { alignItems: 'center', justifyContent: 'center' },
  headerChip: { borderWidth: 1, borderColor: colors.primary, borderRadius: 999, paddingHorizontal: spacing(1.5), paddingVertical: spacing(0.25), marginRight: spacing(5.5) },
  headerChipText: { color: colors.primary, fontWeight: '700', fontSize: 11 },
});
