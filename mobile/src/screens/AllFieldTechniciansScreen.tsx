import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable, Share, Modal, TextInput } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigationTypes';
import { useAuth } from '../auth';
import { adminFetchUsers, adminFetchServiceRoutes, adminUpdateUser, AdminUser, ServiceRoute } from '../api/client';
import { showBanner } from '../components/globalBannerBus';
import { colors, spacing } from '../theme';
import ThemedButton from '../components/Button';
import { truncateText } from '../utils/text';

type Props = NativeStackScreenProps<RootStackParamList, 'AllFieldTechnicians'>;

export default function AllFieldTechniciansScreen({ navigation }: Props) {
  const { token } = useAuth();
  const [techs, setTechs] = useState<AdminUser[]>([]);
  const [routes, setRoutes] = useState<ServiceRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [userRes, routeRes] = await Promise.all([
        adminFetchUsers(token),
        adminFetchServiceRoutes(token),
      ]);
      setTechs((userRes?.users || []).filter(u => u.role === 'tech'));
      setRoutes(routeRes?.routes || []);
    } catch (err: any) {
      showBanner({ type: 'error', message: err?.message || 'Unable to load field technicians.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [token]);

  const getRouteForTech = (techId: number) => routes.find(route => route.user_id === techId);

  const shareTechs = async () => {
    if (!techs.length) {
      showBanner({ type: 'info', message: 'No field techs to share yet.' });
      return;
    }
    const lines = techs.map(user => {
      const assignedRoute = getRouteForTech(user.id);
      const pw = user.managed_password ? ` (${user.managed_password})` : '';
      return `${user.name} (${user.email}${pw}) — Assigned Route: ${assignedRoute ? assignedRoute.name : 'Unassigned'}`;
    });
    try {
      await Share.share({
        title: 'Field Technicians',
        message: `Field Technicians:\n${lines.join('\n')}`,
      });
    } catch {}
  };

  const openEditModal = (user: AdminUser) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditPhone(user.phone || '');
    setEditPassword(user.managed_password || '');
  };

  const closeEditModal = () => {
    setEditingUser(null);
    setEditName('');
    setEditEmail('');
    setEditPhone('');
    setEditPassword('');
  };

  const saveEdit = async () => {
    if (!token || !editingUser) return;
    setSaving(true);
    try {
      await adminUpdateUser(token, editingUser.id, {
        name: editName,
        email: editEmail,
        phone: editPhone,
        managed_password: editPassword,
      });
      showBanner({ type: 'success', message: 'Field tech updated successfully.' });
      closeEditModal();
      await load();
    } catch (err: any) {
      showBanner({ type: 'error', message: err?.message || 'Failed to update user.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>All Field Technicians</Text>
        {techs.length > 0 ? (
          <ThemedButton
            title="Email this list"
            variant="outline"
            onPress={shareTechs}
            style={{ alignSelf: 'flex-start' }}
          />
        ) : null}
        {loading ? (
          <Text style={styles.empty}>Loading…</Text>
        ) : techs.length === 0 ? (
          <Text style={styles.empty}>No field technicians yet.</Text>
        ) : (
          techs.map(user => {
            const assignedRoute = getRouteForTech(user.id);
            return (
              <View key={user.id} style={styles.row}>
                <View style={styles.infoColumn}>
                  <Text style={styles.name}>{truncateText(user.name, 40)}</Text>
                  <Text style={styles.email}>{truncateText(`${user.email}${user.managed_password ? ` (${user.managed_password})` : ''}`, 56)}</Text>
                  {user.phone ? <Text style={styles.phone}>{user.phone}</Text> : null}
                  <Text style={styles.routeLabel}>
                    {assignedRoute ? `Assigned Route: ${assignedRoute.name}` : 'Unassigned'}
                  </Text>
                </View>
                <Pressable
                  style={styles.editBtn}
                  onPress={() => openEditModal(user)}
                >
                  <Text style={styles.editBtnText}>Edit</Text>
                </Pressable>
              </View>
            );
          })
        )}
      </View>

      <Modal
        visible={!!editingUser}
        transparent
        animationType="fade"
        onRequestClose={closeEditModal}
      >
        <View style={styles.modalBackdrop}>
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Edit Field Tech</Text>
              
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing(2) }}>
                <Text style={styles.label}>Name:</Text>
                <TextInput
                  style={styles.input}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Full name"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing(2) }}>
                <Text style={styles.label}>Email:</Text>
                <TextInput
                  style={styles.input}
                  value={editEmail}
                  onChangeText={setEditEmail}
                  placeholder="email@example.com"
                  placeholderTextColor={colors.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing(2) }}>
                <Text style={styles.label}>Phone:</Text>
                <TextInput
                  style={styles.input}
                  value={editPhone}
                  onChangeText={setEditPhone}
                  placeholder="612-555-1234"
                  placeholderTextColor={colors.muted}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing(2) }}>
                <Text style={styles.label}>Password:</Text>
                <TextInput
                  style={styles.input}
                  value={editPassword}
                  onChangeText={setEditPassword}
                  placeholder="Managed password"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <View style={styles.modalActions}>
                <ThemedButton
                  title="Cancel"
                  variant="outline"
                  onPress={closeEditModal}
                  style={styles.modalBtn}
                />
                <ThemedButton
                  title={saving ? 'Saving...' : 'Save'}
                  onPress={saveEdit}
                  disabled={saving}
                  style={styles.modalBtn}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing(4) },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: spacing(3), borderWidth: 1, borderColor: colors.border, gap: spacing(2) },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  empty: { color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingVertical: spacing(1.5), gap: spacing(2) },
  infoColumn: { flex: 1, gap: spacing(0.25) },
  name: { fontWeight: '700', color: colors.text },
  email: { color: colors.muted, fontSize: 13 },
  routeLabel: { color: colors.primary, fontWeight: '600' },
  editBtn: { paddingVertical: spacing(1), paddingHorizontal: spacing(2), borderRadius: 8, borderWidth: 1, borderColor: colors.primary, backgroundColor: 'transparent' },
  editBtnText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalScrollContent: { flexGrow: 1, justifyContent: 'center', padding: spacing(4) },
  modalCard: { width: '100%', maxWidth: 520, backgroundColor: colors.card, borderRadius: 12, padding: spacing(3), gap: spacing(1.5), borderWidth: 1, borderColor: colors.border },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing(1) },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, minWidth: 80, paddingTop: spacing(0.5) },
  input: { flex: 1, minWidth: 320, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: spacing(1), paddingHorizontal: spacing(2), color: colors.text, backgroundColor: colors.background, fontSize: 14 },
  modalActions: { flexDirection: 'row', gap: spacing(2), marginTop: spacing(1) },
  modalBtn: { flex: 1, paddingVertical: spacing(1) },
});
