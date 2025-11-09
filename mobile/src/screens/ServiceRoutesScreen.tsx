import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, Pressable, TextInput, StyleSheet, Modal } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigationTypes';
import { useAuth } from '../auth';
import {
  adminAssignClient,
  adminFetchClients,
  adminFetchRoutes,
  adminFetchUsers,
  adminSetTimelyNote,
  AdminClient,
  AdminRouteAssignment,
  AdminUser,
} from '../api/client';
import ThemedButton from '../components/Button';
import { colors, spacing } from '../theme';
import { showBanner } from '../components/globalBannerBus';

type Props = NativeStackScreenProps<RootStackParamList, 'ServiceRoutes'>;

export default function ServiceRoutesScreen(_props: Props) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [techUsers, setTechUsers] = useState<AdminUser[]>([]);
  const [routes, setRoutes] = useState<AdminRouteAssignment[]>([]);
  const [timelyDrafts, setTimelyDrafts] = useState<Record<number, string>>({});
  const [savingNotes, setSavingNotes] = useState<Record<number, boolean>>({});
  const [assignTarget, setAssignTarget] = useState<AdminClient | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [usersRes, clientsRes, routesRes] = await Promise.all([
        adminFetchUsers(token),
        adminFetchClients(token),
        adminFetchRoutes(token),
      ]);
      setTechUsers(usersRes?.users || []);
      setClients(clientsRes?.clients || []);
      setRoutes(routesRes?.assignments || []);
      setTimelyDrafts(() => {
        const next: Record<number, string> = {};
        (clientsRes?.clients || []).forEach(client => {
          next[client.id] = client.timely_note || '';
        });
        return next;
      });
    } catch (err: any) {
      showBanner({ type: 'error', message: err?.message || 'Unable to load service routes.' });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAssign = async (userId: number | null, clientOverride?: AdminClient | null) => {
    if (!token) return;
    const target = clientOverride ?? assignTarget;
    if (!target) return;
    setAssigning(true);
    try {
      await adminAssignClient(token, { clientId: target.id, userId });
      showBanner({ type: 'success', message: userId ? `Assigned ${target.name}.` : `Removed assignment for ${target.name}.` });
      setModalVisible(false);
      setAssignTarget(null);
      load();
    } catch (err: any) {
      showBanner({ type: 'error', message: err?.message || 'Assignment update failed.' });
    } finally {
      setAssigning(false);
    }
  };

  const handleSaveNote = async (client: AdminClient) => {
    if (!token) return;
    const draft = timelyDrafts[client.id]?.trim() ?? '';
    setSavingNotes(prev => ({ ...prev, [client.id]: true }));
    try {
      await adminSetTimelyNote(token, { clientId: client.id, note: draft });
      showBanner({ type: 'success', message: `Updated note for ${client.name}.` });
      load();
    } catch (err: any) {
      showBanner({ type: 'error', message: err?.message || 'Failed to save note.' });
    } finally {
      setSavingNotes(prev => ({ ...prev, [client.id]: false }));
    }
  };

  const routesByTech = useMemo(() => {
    const map = new Map<number, { info: { name: string; email: string }; clients: AdminRouteAssignment[] }>();
    for (const entry of routes) {
      if (!map.has(entry.user_id)) {
        map.set(entry.user_id, { info: { name: entry.user_name, email: entry.user_email }, clients: [] });
      }
      map.get(entry.user_id)!.clients.push(entry);
    }
    return Array.from(map.entries()).map(([userId, value]) => ({ userId, ...value }));
  }, [routes]);

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
          {presetRoutes.map((route) => (
            <View key={route} style={styles.routeListRow}>
              <Text style={styles.routeListText}>{route}</Text>
            </View>
          ))}
        </View>
        <View style={styles.card}>
          <Text style={styles.title}>Client Assignments</Text>
          {clients.length === 0 ? (
            <Text style={styles.emptyCopy}>No clients yet. Add one first.</Text>
          ) : (
            clients.map((client) => {
              const assigned = client.assigned_user_name ? `${client.assigned_user_name}` : 'Unassigned';
              const saving = savingNotes[client.id];
              return (
                <View key={client.id} style={styles.clientCard}>
                  <View style={styles.clientHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.clientName}>{client.name}</Text>
                      <Text style={styles.clientMeta}>{client.address}</Text>
                      <Text style={styles.clientMetaSmall}>Assigned to: {assigned}</Text>
                    </View>
                    <Pressable
                      style={styles.assignButton}
                      onPress={() => {
                        setAssignTarget(client);
                        setModalVisible(true);
                      }}
                    >
                      <Text style={styles.assignLabel}>Assign</Text>
                    </Pressable>
                  </View>
                  <TextInput
                    style={styles.noteInput}
                    value={timelyDrafts[client.id] ?? ''}
                    onChangeText={(value) => setTimelyDrafts(prev => ({ ...prev, [client.id]: value }))}
                    placeholder="Timely note for this client (optional)"
                    placeholderTextColor={colors.muted}
                    multiline
                  />
                  <ThemedButton
                    title={saving ? 'Saving...' : 'Save Timely Note'}
                    onPress={() => handleSaveNote(client)}
                    disabled={saving}
                  />
                </View>
              );
            })
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Field Tech Routes</Text>
          {routesByTech.length === 0 ? (
            <Text style={styles.emptyCopy}>No active routes yet.</Text>
          ) : (
            routesByTech.map(entry => (
              <View key={entry.userId} style={styles.routeBlock}>
                <Text style={styles.routeTech}>{entry.info.name}</Text>
                <Text style={styles.routeTechMeta}>{entry.info.email}</Text>
                {entry.clients.map((c) => (
                  <View key={`${c.client_id}-${c.scheduled_time}`} style={styles.routeRow}>
                    <Text style={styles.routeClient}>{c.client_name}</Text>
                    <Text style={styles.routeTime}>{c.scheduled_time}</Text>
                  </View>
                ))}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Assign {assignTarget?.name ?? 'client'}</Text>
            <ScrollView style={{ maxHeight: 280 }}>
              {techUsers.length === 0 ? (
                <Text style={styles.emptyCopy}>No field techs yet.</Text>
              ) : (
                techUsers.map((tech) => (
                  <Pressable
                    key={tech.id}
                    style={styles.modalOption}
                    onPress={() => handleAssign(tech.id)}
                    disabled={assigning}
                  >
                    <Text style={styles.modalOptionName}>{tech.name}</Text>
                    <Text style={styles.modalOptionEmail}>{tech.email}</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
            <Pressable style={styles.modalClear} onPress={() => handleAssign(null)} disabled={assigning}>
              <Text style={styles.modalClearLabel}>Clear assignment</Text>
            </Pressable>
            <ThemedButton
              title={assigning ? 'Updating...' : 'Done'}
              onPress={() => setModalVisible(false)}
              style={{ marginTop: spacing(2) }}
            />
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
  routeListRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing(1.5) },
  routeListText: { fontWeight: '600', color: colors.text },
  emptyCopy: { color: colors.muted, fontSize: 15 },
  clientCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: spacing(3), gap: spacing(2) },
  clientHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  clientName: { fontSize: 17, fontWeight: '700', color: colors.text },
  clientMeta: { color: colors.text, fontSize: 14 },
  clientMetaSmall: { color: colors.muted, fontSize: 13 },
  assignButton: { borderWidth: 1, borderColor: colors.primary, borderRadius: 8, paddingHorizontal: spacing(3), paddingVertical: spacing(1.5) },
  assignLabel: { color: colors.primary, fontWeight: '600' },
  noteInput: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing(3),
    color: colors.text,
    textAlignVertical: 'top',
    backgroundColor: colors.background,
  },
  routeBlock: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: spacing(3), gap: spacing(1.5) },
  routeTech: { fontWeight: '700', color: colors.text, fontSize: 16 },
  routeTechMeta: { color: colors.muted, fontSize: 13 },
  routeRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing(1.5) },
  routeClient: { color: colors.text },
  routeTime: { color: colors.muted, fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', padding: spacing(4) },
  modalCard: { width: '100%', maxWidth: 360, backgroundColor: colors.card, borderRadius: 12, padding: spacing(4), gap: spacing(2), borderWidth: 1, borderColor: colors.border },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  modalOption: { paddingVertical: spacing(2), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  modalOptionName: { fontSize: 16, color: colors.text, fontWeight: '600' },
  modalOptionEmail: { fontSize: 13, color: colors.muted },
  modalClear: { paddingVertical: spacing(1.5) },
  modalClearLabel: { color: '#b91c1c', fontWeight: '600' },
});
