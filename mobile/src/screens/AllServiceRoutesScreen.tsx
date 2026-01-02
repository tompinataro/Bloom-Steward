import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Share, Pressable, Linking } from 'react-native';
import * as MailComposer from 'expo-mail-composer';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigationTypes';
import { useAuth } from '../auth';
import { adminAssignServiceRoute, adminFetchClients, adminFetchServiceRoutes, adminFetchUsers, AdminClient, AdminUser, ServiceRoute } from '../api/client';
import { showBanner } from '../components/globalBannerBus';
import { colors, spacing } from '../theme';
import { truncateText } from '../utils/text';
import { useFocusEffect } from '@react-navigation/native';
import ThemedButton from '../components/Button';

type Props = NativeStackScreenProps<RootStackParamList, 'AllServiceRoutes'>;

export default function AllServiceRoutesScreen(_props: Props) {
  const { token } = useAuth();
  const [routes, setRoutes] = useState<ServiceRoute[]>([]);
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [techs, setTechs] = useState<AdminUser[]>([]);
  const [assignRoute, setAssignRoute] = useState<ServiceRoute | null>(null);
  const [sortByAlpha, setSortByAlpha] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [routeRes, clientRes, usersRes] = await Promise.all([
        adminFetchServiceRoutes(token),
        adminFetchClients(token),
        adminFetchUsers(token),
      ]);
      setRoutes(routeRes?.routes || []);
      setClients(clientRes?.clients || []);
      const filteredTechs = (usersRes?.users || []).filter(
        u => u.role === 'tech'
      );
      setTechs(filteredTechs);
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

  useEffect(() => {
    load();
  }, [load]);

  const clientsByRoute = routes.reduce<Record<number, AdminClient[]>>((acc, route) => {
    const list = clients.filter(c => c.service_route_id === route.id);
    const dedup = Array.from(
      new Map(list.map(c => [`${c.name}|${c.address}`, c])).values()
    );
    // Sort client locations: alpha when toggle is on, otherwise by scheduled_time then name
    dedup.sort((a, b) => {
      if (sortByAlpha) {
        return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
      }
      const at = a.scheduled_time ?? '';
      const bt = b.scheduled_time ?? '';
      if (at && bt && at !== bt) return at.localeCompare(bt);
      return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
    });
    acc[route.id] = dedup;
    return acc;
  }, {});

  const shareRoutes = async () => {
    if (!routes.length) {
      showBanner({ type: 'info', message: 'No service routes to share yet.' });
      return;
    }
    const lines = routes.map(route => {
      const assignedClients = (clientsByRoute[route.id] || []).map(client => client.name).join(', ');
      const tech = route.user_name || 'Unassigned';
      return `${route.name}\nTech: ${tech}${assignedClients ? `\nClients: ${assignedClients}` : ''}`;
    });
    const subject = 'Service Routes';
    const body = `Service Routes:\n\n${lines.join('\n\n')}`;
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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>All Service Routes</Text>
          {routes.length > 0 ? (
            <Pressable style={styles.shareChip} onPress={shareRoutes}>
              <Text style={styles.shareChipText}>Email This List</Text>
            </Pressable>
          ) : null}
        </View>
        {loading ? (
          <Text style={styles.empty}>Loading…</Text>
        ) : routes.length === 0 ? (
          <Text style={styles.empty}>No service routes yet.</Text>
        ) : (
          routes
            .sort((a, b) => sortByAlpha ? a.name.localeCompare(b.name) : 0)
            .map(route => (
            <View key={route.id} style={styles.routeBlock}>
              <View style={styles.routeHeader}>
                <Pressable 
                  style={[styles.sortButton, sortByAlpha ? styles.sortButtonAlpha : styles.sortButtonDelta]} 
                  onPress={() => setSortByAlpha(!sortByAlpha)}
                >
                  <View style={styles.outerCircle}>
                    <View style={[styles.innerCircle, sortByAlpha ? styles.innerCircleAlpha : styles.innerCircleDelta]}>
                      <Text style={[styles.sortIcon, sortByAlpha ? styles.sortIconAlpha : styles.sortIconDelta]}>
                        {sortByAlpha ? 'Α' : '△'}
                      </Text>
                    </View>
                  </View>
                </Pressable>
                <Text style={styles.routeName}>{route.name}</Text>
                <Text style={styles.routeTech}>
                  {route.user_name ? `Tech: ${route.user_name}` : 'Unassigned'}
                </Text>
              </View>
              <Pressable onPress={() => setAssignRoute(route)} style={styles.secondaryChip}>
                <Text style={styles.secondaryChipText}>Change Route Assignment</Text>
              </Pressable>
              {(clientsByRoute[route.id] || []).length === 0 ? (
                <Text style={styles.empty}>No client locations placed.</Text>
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
      <RouteAssignModal
        visible={!!assignRoute}
        route={assignRoute}
        techs={techs}
        onSelect={(techId) => {
          if (!token || !assignRoute) return;
          adminAssignServiceRoute(token, { routeId: assignRoute.id, userId: techId })
            .then(() => {
              showBanner({ type: 'success', message: 'Route assignment updated.' });
              setAssignRoute(null);
              load();
            })
            .catch((err: any) => showBanner({ type: 'error', message: err?.message || 'Unable to assign route.' }));
        }}
        onClose={() => setAssignRoute(null)}
      />
    </ScrollView>
  );
}

function RouteAssignModal({
  visible,
  route,
  techs,
  onSelect,
  onClose,
}: {
  visible: boolean;
  route: ServiceRoute | null;
  techs: AdminUser[];
  onSelect: (techId: number | null) => void;
  onClose: () => void;
}) {
  if (!visible || !route) return null;
  return (
    <View style={styles.modalBackdrop} pointerEvents="box-none">
      <View style={styles.modalCard}>
        <Text style={styles.modalTitle}>Assign {route.name}</Text>
        <ScrollView style={{ maxHeight: 360 }}>
          {techs.map(t => (
            <ThemedButton
              key={t.id}
              title={t.name}
              variant="outline"
              onPress={() => onSelect(t.id)}
              style={{ marginBottom: spacing(1) }}
            />
          ))}
          <ThemedButton title="Clear assignment" variant="outline" onPress={() => onSelect(null)} />
        </ScrollView>
        <ThemedButton title="Cancel" variant="ghost" onPress={onClose} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing(4), gap: spacing(3) },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: spacing(3), borderWidth: 1, borderColor: colors.border, gap: spacing(2) },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  empty: { color: colors.muted },
  routeBlock: { paddingTop: spacing(1.5), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, gap: spacing(0.75) },
  routeHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
  routeName: { fontSize: 18, fontWeight: '700', color: colors.text, flex: 1 },
  routeTech: { color: colors.muted },
  sortButton: { width: 34, height: 34, justifyContent: 'center', alignItems: 'center' },
  sortButtonAlpha: { backgroundColor: colors.background },
  sortButtonDelta: { backgroundColor: '#dc2626' },
  outerCircle: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: colors.text, justifyContent: 'center', alignItems: 'center' },
  innerCircle: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  innerCircleAlpha: { borderColor: colors.text, backgroundColor: colors.background },
  innerCircleDelta: { borderColor: '#dc2626', backgroundColor: '#dc2626' },
  sortIcon: { fontSize: 18, fontWeight: '700' },
  sortIconAlpha: { color: colors.text },
  sortIconDelta: { color: '#ffffff' },
  clientLine: { color: colors.text, paddingLeft: spacing(1) },
  modalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', padding: spacing(4) },
  modalCard: { width: '100%', maxWidth: 380, backgroundColor: colors.card, borderRadius: 12, padding: spacing(4), gap: spacing(2), borderWidth: 1, borderColor: colors.border },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing(1) },
  shareChip: { alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.primary, borderRadius: 999, paddingHorizontal: spacing(2), paddingVertical: spacing(0.5) },
  shareChipText: { color: colors.primary, fontWeight: '600', fontSize: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  secondaryChip: { alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.primary, borderRadius: 999, paddingHorizontal: spacing(2), paddingVertical: spacing(0.5) },
  secondaryChipText: { color: colors.primary, fontWeight: '600', fontSize: 12 },
});
