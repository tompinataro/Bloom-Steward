import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  RefreshControl,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigationTypes';
import { useAuth } from '../auth';
import {
  adminAssignClient,
  adminCreateClient,
  adminCreateUser,
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

type Props = NativeStackScreenProps<RootStackParamList, 'Account'>;

function formatRole(role?: string | null) {
  if (role === 'admin') return 'Admin';
  if (role === 'tech') return 'Field Tech';
  return 'User';
}

export default function AccountScreen({ navigation }: Props) {
  const { user, token, signOut } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [techUsers, setTechUsers] = useState<AdminUser[]>([]);
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [routes, setRoutes] = useState<AdminRouteAssignment[]>([]);

  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);
  const [lastCreatedUser, setLastCreatedUser] = useState<{ name: string; tempPassword: string } | null>(null);

  const [newClientName, setNewClientName] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('');
  const [newClientContactName, setNewClientContactName] = useState('');
  const [newClientContactPhone, setNewClientContactPhone] = useState('');
  const [creatingClient, setCreatingClient] = useState(false);

  const [timelyDrafts, setTimelyDrafts] = useState<Record<number, string>>({});
  const [savingNotes, setSavingNotes] = useState<Record<number, boolean>>({});

  const [assignTarget, setAssignTarget] = useState<AdminClient | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const ensureAdminToken = useCallback(() => {
    if (!token) {
      showBanner({ type: 'error', message: 'Session expired - please sign in again.' });
      return false;
    }
    if (!isAdmin) {
      showBanner({ type: 'info', message: 'Admin permissions required to manage accounts.' });
      return false;
    }
    return true;
  }, [token, isAdmin]);

  const loadAll = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!ensureAdminToken()) return;
      try {
        if (!opts?.silent) setLoading(true);
        const [usersRes, clientsRes, routesRes] = await Promise.all([
          adminFetchUsers(token!),
          adminFetchClients(token!),
          adminFetchRoutes(token!),
        ]);
        const techs = (usersRes?.users || []).filter((u) => u.role === 'tech');
        setTechUsers(techs);
        setClients(clientsRes?.clients || []);
        setRoutes(routesRes?.assignments || []);
        setTimelyDrafts(() => {
          const next: Record<number, string> = {};
          for (const client of clientsRes?.clients || []) {
            next[client.id] = client.timely_note || '';
          }
          return next;
        });
      } catch (err: any) {
        const msg = err?.message ? String(err.message) : 'Unable to load admin data.';
        showBanner({ type: 'error', message: msg });
      } finally {
        if (!opts?.silent) setLoading(false);
        setRefreshing(false);
      }
    },
    [token, ensureAdminToken]
  );

  useEffect(() => {
    if (token && isAdmin) {
      loadAll();
    }
  }, [token, isAdmin, loadAll]);

  const onRefresh = useCallback(async () => {
    if (!ensureAdminToken()) return;
    setRefreshing(true);
    await loadAll({ silent: true });
  }, [ensureAdminToken, loadAll]);

  const handleCreateUser = useCallback(async () => {
    if (!ensureAdminToken()) return;
    const name = newUserName.trim();
    const email = newUserEmail.trim().toLowerCase();
    if (!name || !email) {
      showBanner({ type: 'error', message: 'Name and email are required.' });
      return;
    }
    setCreatingUser(true);
    try {
      const res = await adminCreateUser(token!, { name, email, role: 'tech' });
      if (res?.ok) {
        setLastCreatedUser({ name: res.user.name, tempPassword: res.tempPassword });
        showBanner({ type: 'success', message: `Created ${res.user.name}. Share their temporary password securely.` });
        setNewUserName('');
        setNewUserEmail('');
        await loadAll({ silent: true });
      }
    } catch (err: any) {
      const msg = err?.message ? String(err.message) : 'Unable to create user.';
      showBanner({ type: 'error', message: msg });
    } finally {
      setCreatingUser(false);
    }
  }, [ensureAdminToken, loadAll, newUserEmail, newUserName, token]);

  const handleCreateClient = useCallback(async () => {
    if (!ensureAdminToken()) return;
    const name = newClientName.trim();
    const address = newClientAddress.trim();
    if (!name || !address) {
      showBanner({ type: 'error', message: 'Client name and address are required.' });
      return;
    }
    setCreatingClient(true);
    try {
      const res = await adminCreateClient(token!, {
        name,
        address,
        contactName: newClientContactName.trim() || undefined,
        contactPhone: newClientContactPhone.trim() || undefined,
      });
      if (res?.ok) {
        showBanner({ type: 'success', message: `Added ${res.client.name}.` });
        setNewClientName('');
        setNewClientAddress('');
        setNewClientContactName('');
        setNewClientContactPhone('');
        await loadAll({ silent: true });
      }
    } catch (err: any) {
      const msg = err?.message ? String(err.message) : 'Unable to add client.';
      showBanner({ type: 'error', message: msg });
    } finally {
      setCreatingClient(false);
    }
  }, [
    ensureAdminToken,
    loadAll,
    newClientAddress,
    newClientContactName,
    newClientContactPhone,
    newClientName,
    token,
  ]);

  const handleAssign = useCallback(
    async (userId: number | null, clientOverride?: AdminClient | null) => {
      if (!ensureAdminToken()) return;
      const target = clientOverride ?? assignTarget;
      if (!target) return;
      setAssigning(true);
      try {
        await adminAssignClient(token!, { clientId: target.id, userId });
        showBanner({
          type: 'success',
          message: userId ? `Assigned ${target.name}.` : `Removed assignment for ${target.name}.`,
        });
        if (!clientOverride) {
          setModalVisible(false);
          setAssignTarget(null);
        }
        await loadAll({ silent: true });
      } catch (err: any) {
        const msg = err?.message ? String(err.message) : 'Assignment update failed.';
        showBanner({ type: 'error', message: msg });
      } finally {
        setAssigning(false);
      }
    },
    [assignTarget, ensureAdminToken, loadAll, token]
  );

  const handleSaveNote = useCallback(
    async (client: AdminClient) => {
      if (!ensureAdminToken()) return;
      const draft = timelyDrafts[client.id]?.trim() ?? '';
      setSavingNotes((prev) => ({ ...prev, [client.id]: true }));
      try {
        await adminSetTimelyNote(token!, { clientId: client.id, note: draft });
        showBanner({ type: 'success', message: `Updated timely note for ${client.name}.` });
        await loadAll({ silent: true });
      } catch (err: any) {
        const msg = err?.message ? String(err.message) : 'Unable to save note.';
        showBanner({ type: 'error', message: msg });
      } finally {
        setSavingNotes((prev) => ({ ...prev, [client.id]: false }));
      }
    },
    [ensureAdminToken, loadAll, timelyDrafts, token]
  );

  const routesByTech = useMemo(() => {
    const map = new Map<number, { info: { name: string; email: string }; clients: AdminRouteAssignment[] }>();
    for (const entry of routes) {
      if (!map.has(entry.user_id)) {
        map.set(entry.user_id, { info: { name: entry.user_name, email: entry.user_email }, clients: [] });
      }
      map.get(entry.user_id)!.clients.push(entry);
    }
    return Array.from(map.entries()).map(([userId, value]) => ({
      userId,
      ...value,
    }));
  }, [routes]);

  const renderAdminContent = () => {
    if (!isAdmin) return null;
    return (
      <>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Add Field Tech</Text>
          <Text style={styles.bodyCopy}>
            Create a field tech account and share the temporary password with them. They can request a personalized
            password from you later.
          </Text>
          <TextInput
            style={styles.input}
            value={newUserName}
            onChangeText={setNewUserName}
            placeholder="Full name"
            placeholderTextColor={colors.muted}
            autoCapitalize="words"
            returnKeyType="next"
          />
          <TextInput
            style={styles.input}
            value={newUserEmail}
            onChangeText={setNewUserEmail}
            placeholder="Email"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="done"
          />
          <ThemedButton
            title={creatingUser ? 'Creating...' : 'Create Field Tech'}
            onPress={handleCreateUser}
            disabled={creatingUser}
          />
          {lastCreatedUser ? (
            <View style={styles.noticeBox}>
              <Text style={styles.noticeTitle}>Share with {lastCreatedUser.name}</Text>
              <Text style={styles.noticeBody}>Temporary password: {lastCreatedUser.tempPassword}</Text>
              <Text style={styles.noticeFootnote}>Ask them to change it with you after first sign-in.</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Add Client Location</Text>
          <TextInput
            style={styles.input}
            value={newClientName}
            onChangeText={setNewClientName}
            placeholder="Client name"
            placeholderTextColor={colors.muted}
          />
          <TextInput
            style={styles.input}
            value={newClientAddress}
            onChangeText={setNewClientAddress}
            placeholder="Service address"
            placeholderTextColor={colors.muted}
          />
          <TextInput
            style={styles.input}
            value={newClientContactName}
            onChangeText={setNewClientContactName}
            placeholder="Primary contact (optional)"
            placeholderTextColor={colors.muted}
          />
          <TextInput
            style={styles.input}
            value={newClientContactPhone}
            onChangeText={setNewClientContactPhone}
            placeholder="Contact phone (optional)"
            placeholderTextColor={colors.muted}
            keyboardType="phone-pad"
          />
          <ThemedButton
            title={creatingClient ? 'Saving...' : 'Add Client'}
            onPress={handleCreateClient}
            disabled={creatingClient}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Clients & Assignments</Text>
          <Text style={styles.bodyCopy}>
            Assign each client to a field tech and enter any Timely notes you want the tech to acknowledge during their
            visit.
          </Text>
          {clients.length === 0 ? (
            <Text style={styles.emptyCopy}>No clients yet. Add one above to get started.</Text>
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
                      accessibilityRole="button"
                    >
                      <Text style={styles.assignLabel}>Assign</Text>
                    </Pressable>
                  </View>
                  <TextInput
                    style={styles.noteInput}
                    value={timelyDrafts[client.id] ?? ''}
                    onChangeText={(value) => setTimelyDrafts((prev) => ({ ...prev, [client.id]: value }))}
                    placeholder="Timely note for this client (optional)"
                    placeholderTextColor={colors.muted}
                    multiline
                  />
                  <View style={styles.clientActions}>
                    <ThemedButton
                      title={saving ? 'Saving...' : 'Save Timely Note'}
                      onPress={() => handleSaveNote(client)}
                      disabled={saving}
                      style={{ flex: 1 }}
                    />
                    <Pressable
                      style={styles.clearButton}
                      onPress={() =>
                        Alert.alert('Remove assignment?', `Unassign ${client.name}?`, [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Remove', style: 'destructive', onPress: () => handleAssign(null, client) },
                        ])
                      }
                    >
                      <Text style={styles.clearLabel}>Clear Assignment</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Field Tech Routes</Text>
          {routesByTech.length === 0 ? (
            <Text style={styles.emptyCopy}>No active routes yet. Assign clients to see today's list.</Text>
          ) : (
            routesByTech.map((entry) => (
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
      </>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={isAdmin ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
      >
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Text style={styles.bodyCopy}>{user?.name}</Text>
          <Text style={styles.bodyCopyMuted}>{user?.email}</Text>
          <Text style={styles.badge}>{formatRole(user?.role)}</Text>
          <View style={styles.accountActions}>
            <ThemedButton title="Sign Out" onPress={signOut} style={{ flex: 1 }} />
            <Pressable
              style={styles.deleteLink}
              onPress={() => navigation.navigate('DeleteAccount')}
              accessibilityRole="button"
            >
              <Text style={styles.deleteText}>Delete account</Text>
            </Pressable>
          </View>
        </View>
        {isAdmin ? renderAdminContent() : (
          <View style={styles.card}>
            <Text style={styles.bodyCopy}>
              Looking for route assignments or client updates? Contact an administrator to make changes.
            </Text>
          </View>
        )}
        {loading ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Loading admin data...</Text>
          </View>
        ) : null}
      </ScrollView>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!assigning) {
            setModalVisible(false);
            setAssignTarget(null);
          }
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Assign {assignTarget?.name ?? 'client'}
            </Text>
            <ScrollView style={{ maxHeight: 280 }}>
              {techUsers.length === 0 ? (
                <Text style={styles.emptyCopy}>No field techs yet. Add one first.</Text>
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
            <Pressable
              style={styles.modalClear}
              onPress={() => handleAssign(null)}
              disabled={assigning}
            >
              <Text style={styles.modalClearLabel}>Clear assignment</Text>
            </Pressable>
            <ThemedButton
              title={assigning ? 'Updating...' : 'Done'}
              onPress={() => {
                if (!assigning) {
                  setModalVisible(false);
                  setAssignTarget(null);
                }
              }}
              style={{ marginTop: spacing(2) }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing(4),
    gap: spacing(4),
    paddingBottom: spacing(16),
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing(4),
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing(2),
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  bodyCopy: {
    fontSize: 16,
    color: colors.text,
  },
  bodyCopyMuted: {
    fontSize: 15,
    color: colors.muted,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e5e7eb',
    color: '#1f2937',
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1),
    borderRadius: 6,
    fontWeight: '600',
    fontSize: 13,
  },
  accountActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    marginTop: spacing(2),
  },
  deleteLink: {
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1.5),
  },
  deleteText: {
    color: '#b91c1c',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    color: colors.text,
    backgroundColor: colors.card,
  },
  noticeBox: {
    marginTop: spacing(3),
    padding: spacing(3),
    backgroundColor: '#ecfdf5',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#6ee7b7',
    gap: spacing(1),
  },
  noticeTitle: {
    fontWeight: '700',
    color: '#047857',
  },
  noticeBody: {
    color: '#065f46',
    fontSize: 16,
  },
  noticeFootnote: {
    color: '#047857',
    fontSize: 13,
  },
  emptyCopy: {
    color: colors.muted,
    fontSize: 15,
  },
  clientCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing(3),
    gap: spacing(2),
    marginTop: spacing(3),
  },
  clientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
  },
  clientName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  clientMeta: {
    color: colors.text,
    fontSize: 14,
  },
  clientMetaSmall: {
    color: colors.muted,
    fontSize: 13,
  },
  assignButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
  },
  assignLabel: {
    color: colors.primary,
    fontWeight: '600',
  },
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
  clientActions: {
    flexDirection: 'row',
    gap: spacing(2),
    alignItems: 'center',
  },
  clearButton: {
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(2),
  },
  clearLabel: {
    color: '#b91c1c',
    fontWeight: '600',
  },
  routeBlock: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing(3),
    gap: spacing(1),
    marginTop: spacing(3),
  },
  routeTech: {
    fontWeight: '700',
    color: colors.text,
    fontSize: 16,
  },
  routeTechMeta: {
    color: colors.muted,
    fontSize: 13,
  },
  routeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing(1.5),
    marginTop: spacing(1.5),
  },
  routeClient: {
    color: colors.text,
    fontSize: 15,
  },
  routeTime: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  loadingOverlay: {
    marginTop: spacing(2),
    alignItems: 'center',
    gap: spacing(1),
  },
  loadingText: {
    color: colors.muted,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing(4),
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing(4),
    gap: spacing(2),
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  modalOption: {
    paddingVertical: spacing(2),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  modalOptionName: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
  },
  modalOptionEmail: {
    fontSize: 13,
    color: colors.muted,
  },
  modalClear: {
    paddingVertical: spacing(1.5),
  },
  modalClearLabel: {
    color: '#b91c1c',
    fontWeight: '600',
  },
});
