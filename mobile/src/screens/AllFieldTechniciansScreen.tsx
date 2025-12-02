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
      {/* Editing handled in dedicated screen now */}
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
                  onPress={() => (navigation as any)?.navigate?.('EditFieldTech', { user })}
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

              <View style={styles.inputBlock}>
                <Text style={styles.blockLabel}>Name</Text>
                <TextInput
                  style={styles.blockInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Full name"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <View style={styles.inputBlock}>
                <Text style={styles.blockLabel}>Email</Text>
                <TextInput
                  style={styles.blockInput}
                  value={editEmail}
                  onChangeText={setEditEmail}
                  placeholder="email@example.com"
                  placeholderTextColor={colors.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputBlock}>
                <Text style={styles.blockLabel}>Phone</Text>
                <TextInput
                  style={styles.blockInput}
                  value={editPhone}
                  onChangeText={setEditPhone}
                  placeholder="612-555-1234"
                  placeholderTextColor={colors.muted}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputBlock}>
                <Text style={styles.blockLabel}>Password</Text>
                <TextInput
                  style={styles.blockInput}
                  value={editPassword}
                  onChangeText={setEditPassword}
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
  modalScrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing(1), paddingVertical: spacing(4) },
  modalCard: { alignSelf: 'stretch', width: '92%', backgroundColor: colors.card, borderRadius: 12, padding: spacing(3), borderWidth: 1, borderColor: colors.border },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing(2) },
  inputBlock: { marginBottom: spacing(1.5) },
  blockLabel: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: spacing(0.5) },
  blockInput: { width: '100%', borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: spacing(1), paddingHorizontal: spacing(2), color: colors.text, backgroundColor: colors.background, fontSize: 14 },
  modalActions: { flexDirection: 'row', gap: spacing(2), marginTop: spacing(1) },
  modalBtn: { flex: 1, paddingVertical: spacing(1) },
});
