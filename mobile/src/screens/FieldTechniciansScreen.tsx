import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, TextInput, StyleSheet, Modal, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigationTypes';
import { useAuth } from '../auth';
import { showBanner } from '../components/globalBannerBus';
import { adminCreateUser, adminFetchUsers, adminSetUserPassword, AdminUser } from '../api/client';
import ThemedButton from '../components/Button';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'FieldTechnicians'>;

export default function FieldTechniciansScreen(_props: Props) {
  const { token } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [lastTemp, setLastTemp] = useState<{ name: string; password: string } | null>(null);
  const [techUsers, setTechUsers] = useState<AdminUser[]>([]);
  const [pwModal, setPwModal] = useState<{ id: number; name: string } | null>(null);
  const [newPw, setNewPw] = useState('');

  const load = async () => {
    if (!token) return;
    try {
      const res = await adminFetchUsers(token);
      setTechUsers((res?.users || []).filter(u => u.role === 'tech'));
    } catch (err: any) {
      showBanner({ type: 'error', message: err?.message || 'Unable to load field techs.' });
    }
  };

  useEffect(() => {
    load();
  }, [token]);

  const createTech = async () => {
    if (!token) return;
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedName || !trimmedEmail) {
      showBanner({ type: 'error', message: 'Name and email are required.' });
      return;
    }
    setCreating(true);
    try {
      const res = await adminCreateUser(token, { name: trimmedName, email: trimmedEmail, role: 'tech' });
      if (res?.ok) {
        setLastTemp({ name: res.user.name, password: res.tempPassword });
        setName('');
        setEmail('');
        showBanner({ type: 'success', message: `Added ${res.user.name}. Share their temp password.` });
        await load();
      }
    } catch (err: any) {
      showBanner({ type: 'error', message: err?.message || 'Unable to add field tech.' });
    } finally {
      setCreating(false);
    }
  };

  const updatePassword = async () => {
    if (!token || !pwModal) return;
    const trimmed = newPw.trim();
    if (trimmed.length < 8) {
      showBanner({ type: 'error', message: 'Password must be at least 8 characters.' });
      return;
    }
    try {
      await adminSetUserPassword(token, { userId: pwModal.id, newPassword: trimmed });
      showBanner({ type: 'success', message: 'Password updated.' });
      setNewPw('');
      setPwModal(null);
    } catch (err: any) {
      showBanner({ type: 'error', message: err?.message || 'Unable to update password.' });
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Create Field Tech</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Full name"
          placeholderTextColor={colors.muted}
          autoCapitalize="words"
          returnKeyType="next"
        />
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          keyboardType="email-address"
          returnKeyType="done"
        />
        <ThemedButton title={creating ? 'Adding...' : 'Add Field Tech'} onPress={createTech} disabled={creating} />
        {lastTemp ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              {formatPossessive(lastTemp.name)} temp pw = {lastTemp.password}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.card}>
        <Text style={styles.subTitle}>Current Field Techs</Text>
        {techUsers.length === 0 ? (
          <Text style={styles.emptyCopy}>No field techs yet.</Text>
          ) : (
            <ScrollView
              style={styles.listScroll}
              contentContainerStyle={styles.listScrollContent}
              nestedScrollEnabled
            >
              {techUsers.map(user => (
                <View key={user.id} style={styles.listRow}>
                  <View style={{ flex: 1 }}>
                  <Text style={styles.listName}>
                    {user.name}
                    {user.managed_password ? (
                      <Text style={styles.pwInline}> ({user.managed_password})</Text>
                    ) : null}
                  </Text>
                  <Text style={styles.listEmail}>{user.email}</Text>
                </View>
                <Pressable style={styles.pwChip} onPress={() => setPwModal({ id: user.id, name: user.name })}>
                  <Text style={styles.pwChipText}>Set password</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
          )}
      </View>
      <Modal visible={!!pwModal} transparent animationType="fade" onRequestClose={() => setPwModal(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Update password for {pwModal?.name}</Text>
            <TextInput
              style={styles.input}
              value={newPw}
              onChangeText={setNewPw}
              placeholder="New password"
              placeholderTextColor={colors.muted}
              secureTextEntry
            />
            <ThemedButton title="Save" onPress={updatePassword} />
            <ThemedButton title="Cancel" variant="outline" onPress={() => setPwModal(null)} />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function formatPossessive(name?: string | null) {
  if (!name) return '';
  const trimmed = name.trim();
  if (!trimmed) return '';
  return /s$/i.test(trimmed) ? `${trimmed}'` : `${trimmed}'s`;
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
  notice: { marginTop: spacing(2), padding: spacing(2), backgroundColor: '#ecfdf5', borderRadius: 10, borderWidth: 1, borderColor: '#6ee7b7' },
  noticeText: { color: '#047857', fontWeight: '600' },
  pwInline: { fontSize: 14, fontWeight: '500', color: colors.muted },
  pwChip: { borderWidth: 1, borderColor: colors.primary, borderRadius: 999, paddingHorizontal: spacing(2), paddingVertical: spacing(1), alignSelf: 'flex-start' },
  pwChipText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  listRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing(1.5) },
  listName: { fontWeight: '600', color: colors.text },
  listEmail: { color: colors.muted },
  emptyCopy: { color: colors.muted },
  listScroll: { maxHeight: 260 },
  listScrollContent: { paddingVertical: spacing(1), gap: spacing(1) },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', padding: spacing(4) },
  modalCard: { width: '100%', maxWidth: 360, backgroundColor: colors.card, borderRadius: 12, padding: spacing(4), gap: spacing(2), borderWidth: 1, borderColor: colors.border },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
});
