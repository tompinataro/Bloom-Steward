import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, TextInput, StyleSheet, Modal, Pressable, Share, FlatList, Linking, Platform } from 'react-native';
import * as MailComposer from 'expo-mail-composer';
import * as Location from 'expo-location';
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
  adminUpdateClient,
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
  const [editClient, setEditClient] = useState<UniqueClient | null>(null);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editRegion, setEditRegion] = useState('');
  const [editZip, setEditZip] = useState('');
  const [editContactName, setEditContactName] = useState('');
  const [editContactPhone, setEditContactPhone] = useState('');
  const [editLatitude, setEditLatitude] = useState('');
  const [editLongitude, setEditLongitude] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

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

  const parseAddressParts = (value: string) => {
    const parts = value.split(',').map(part => part.trim()).filter(Boolean);
    const street = parts[0] || value.trim();
    const cityPart = parts[1] || '';
    let statePart = '';
    let zipPart = '';
    if (parts[2]) {
      const rest = parts[2].split(/\s+/).filter(Boolean);
      statePart = rest[0] || '';
      zipPart = rest.slice(1).join(' ');
    }
    return { street, cityPart, statePart, zipPart };
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

  const openEdit = (client: UniqueClient) => {
    const fallbackParts = parseAddressParts(client.address || '');
    setEditClient(client);
    setEditName(client.name || '');
    setEditAddress(client.address ? (client.address.split(',')[0]?.trim() || client.address) : '');
    setEditCity(client.city || fallbackParts.cityPart);
    setEditRegion(client.state || fallbackParts.statePart);
    setEditZip(client.zip || fallbackParts.zipPart);
    setEditContactName(client.contact_name || '');
    setEditContactPhone(client.contact_phone || '');
    setEditLatitude(client.latitude != null ? String(client.latitude) : '');
    setEditLongitude(client.longitude != null ? String(client.longitude) : '');
  };

  const saveEdit = async () => {
    if (!token || !editClient) return;
    const trimmedName = editName.trim();
    const trimmedAddress = editAddress.trim();
    if (!trimmedName || !trimmedAddress) {
      showBanner({ type: 'error', message: 'Name and address are required.' });
      return;
    }
    const trimmedCity = editCity.trim();
    const trimmedRegion = editRegion.trim();
    const trimmedZip = editZip.trim();
    const fullAddress = buildFullAddress(trimmedAddress, trimmedCity, trimmedRegion, trimmedZip);
    setSavingEdit(true);
    try {
      const lat = editLatitude.trim();
      const lng = editLongitude.trim();
      const latValue = lat ? Number(lat) : undefined;
      const lngValue = lng ? Number(lng) : undefined;
      const payload = {
        name: trimmedName,
        address: fullAddress,
        city: trimmedCity || undefined,
        state: trimmedRegion || undefined,
        zip: trimmedZip || undefined,
        contact_name: editContactName.trim() || undefined,
        contact_phone: editContactPhone.trim() || undefined,
        latitude: Number.isFinite(latValue as number) ? (latValue as number) : undefined,
        longitude: Number.isFinite(lngValue as number) ? (lngValue as number) : undefined,
      };
      await Promise.all(
        editClient.duplicateIds.map(id => adminUpdateClient(token, { id, ...payload }))
      );
      showBanner({ type: 'success', message: 'Client updated.' });
      setEditClient(null);
      await load();
    } catch (err: any) {
      showBanner({ type: 'error', message: err?.message || 'Unable to update client.' });
    } finally {
      setSavingEdit(false);
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
    const subject = 'Client Locations';
    const body = `Client Locations:\n\n${lines.join('\n\n')}`;
    const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    try {
      if (await MailComposer.isAvailableAsync()) {
        await MailComposer.composeAsync({ subject, body });
        return;
      }
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

  const setLatLongToCurrentLocation = async () => {
    if (Platform.OS === 'web') {
      showBanner({ type: 'info', message: 'Current location is only available on mobile.' });
      return;
    }
    const fullAddress = buildFullAddress(address, city, region, zip);
    if (fullAddress) {
      try {
        const results = await Location.geocodeAsync(fullAddress);
        if (results?.length) {
          setLatitude(results[0].latitude.toFixed(6));
          setLongitude(results[0].longitude.toFixed(6));
          showBanner({ type: 'success', message: 'Lat/long set from the address.' });
          return;
        }
      } catch {}
    }
    try {
      const status = await Location.getForegroundPermissionsAsync();
      if (status.status !== 'granted') {
        const req = await Location.requestForegroundPermissionsAsync();
        if (req.status !== 'granted') {
          showBanner({ type: 'info', message: 'Location permission denied.' });
          return;
        }
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      setLatitude(pos.coords.latitude.toFixed(6));
      setLongitude(pos.coords.longitude.toFixed(6));
      showBanner({ type: 'success', message: 'Lat/long set from current location.' });
    } catch (err: any) {
      showBanner({ type: 'error', message: err?.message || 'Unable to read current location.' });
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
    >
      {!showAll && (
        <View style={styles.card}>
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
            keyboardType="default"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            value={longitude}
            onChangeText={setLongitude}
            placeholder="Longitude (optional)"
            placeholderTextColor={colors.muted}
            keyboardType="default"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <ThemedButton title="Set Lat/Long to Current Location" variant="outline" onPress={setLatLongToCurrentLocation} />
          <ThemedButton title={creating ? 'Adding...' : 'Add Client Location'} onPress={addClient} disabled={creating} />
        </View>
      )}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          {showAll && uniqueClients.length ? (
            <Pressable style={styles.shareChip} onPress={shareClients}>
              <Text style={styles.shareChipText}>Email This List</Text>
            </Pressable>
          ) : null}
          {!showAll && <Text style={styles.subTitle}>Locations Awaiting Placement</Text>}
          {showAll && <Text style={styles.instructionText}>(Tap to see Route)</Text>}
        </View>
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
                  <View style={styles.rowActions}>
                    <Pressable style={styles.editPill} onPress={() => openEdit(client)}>
                      <Text style={styles.editPillText}>Edit</Text>
                    </Pressable>
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
      <Modal
        visible={!!editClient}
        transparent
        animationType="fade"
        onRequestClose={() => setEditClient(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Client Location</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="Client name"
              placeholderTextColor={colors.muted}
            />
            <TextInput
              style={styles.input}
              value={editAddress}
              onChangeText={setEditAddress}
              placeholder="Service address"
              placeholderTextColor={colors.muted}
            />
            <TextInput
              style={styles.input}
              value={editCity}
              onChangeText={setEditCity}
              placeholder="City"
              placeholderTextColor={colors.muted}
            />
            <TextInput
              style={styles.input}
              value={editRegion}
              onChangeText={setEditRegion}
              placeholder="State"
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
            />
            <TextInput
              style={styles.input}
              value={editZip}
              onChangeText={setEditZip}
              placeholder="Zip"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
            />
            <TextInput
              style={styles.input}
              value={editContactName}
              onChangeText={setEditContactName}
              placeholder="Primary contact (optional)"
              placeholderTextColor={colors.muted}
            />
            <TextInput
              style={styles.input}
              value={editContactPhone}
              onChangeText={setEditContactPhone}
              placeholder="Contact phone (optional)"
              placeholderTextColor={colors.muted}
              keyboardType="phone-pad"
            />
            <TextInput
              style={styles.input}
              value={editLatitude}
              onChangeText={setEditLatitude}
              placeholder="Latitude (optional)"
              placeholderTextColor={colors.muted}
              keyboardType="default"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={styles.input}
              value={editLongitude}
              onChangeText={setEditLongitude}
              placeholder="Longitude (optional)"
              placeholderTextColor={colors.muted}
              keyboardType="default"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <ThemedButton title={savingEdit ? 'Saving...' : 'Save'} onPress={saveEdit} disabled={savingEdit} />
            <ThemedButton title="Cancel" variant="outline" onPress={() => setEditClient(null)} />
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
  subTitle: { fontSize: 16, fontWeight: '700', color: colors.text, textAlign: 'center' },
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
  rowActions: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing(4) },
  routePill: { borderColor: colors.primary, borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing(1.5), paddingVertical: spacing(0.5), minWidth: 88, alignItems: 'center', flexShrink: 1, maxWidth: 120 },
  routePillUnassigned: { backgroundColor: colors.primary, borderColor: colors.primary },
  routePillText: { color: colors.primary, fontWeight: '600', textAlign: 'center', flexShrink: 1, fontSize: 13 },
  routePillTextUnassigned: { color: colors.card, fontSize: 11 },
  editPill: { borderColor: colors.primary, borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing(2), paddingVertical: spacing(0.5), alignSelf: 'center' },
  editPillText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  modalOptionText: { fontSize: 16, color: colors.text, fontWeight: '600' },
  modalOptionSub: { fontSize: 13, color: colors.muted },
  shareChip: { borderWidth: 1, borderColor: colors.primary, borderRadius: 999, paddingHorizontal: spacing(2), paddingVertical: spacing(0.5) },
  shareChipText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  instructionText: { fontSize: 14, color: colors.text, fontWeight: '700' },
  cardHeader: { alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing(2) },
});
