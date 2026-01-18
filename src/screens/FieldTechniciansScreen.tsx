import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, TextInput, StyleSheet, Modal, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigationTypes';
import { useAuth } from '../auth';
import { showBanner } from '../components/globalBannerBus';
import { adminCreateUser, adminFetchUsers, adminFetchServiceRoutes, AdminUser, ServiceRoute } from '../api/client';
import ThemedButton from '../components/Button';
import Card from '../components/Card';
import ListRow from '../components/ListRow';
import { colors, spacing } from '../theme';
import { truncateText } from '../utils/text';

type Props = NativeStackScreenProps<RootStackParamList, 'FieldTechnicians'>;

export default function FieldTechniciansScreen({ route, navigation }: Props) {
  const { token } = useAuth();
  const showAll = route.params?.mode === 'all';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [creating, setCreating] = useState(false);
  const [lastTemp, setLastTemp] = useState<{ name: string; password: string } | null>(null);
  const [techUsers, setTechUsers] = useState<AdminUser[]>([]);
  const [serviceRoutes, setServiceRoutes] = useState<ServiceRoute[]>([]);

  const load = async () => {
    if (!token) return;
    try {
      const [usersRes, routesRes] = await Promise.all([
        adminFetchUsers(token),
        adminFetchServiceRoutes(token),
      ]);
      const techs = (usersRes?.users || []).filter(
        u => u.role === 'tech'
      );
      const sortedTechs = techs.slice().sort((a, b) => {
        const [aLast = '', aFirst = ''] = (a.name || '').trim().split(/\s+?(.+)?/).filter(Boolean).reverse();
        const [bLast = '', bFirst = ''] = (b.name || '').trim().split(/\s+?(.+)?/).filter(Boolean).reverse();
        const lastCmp = aLast.localeCompare(bLast, undefined, { sensitivity: 'base' });
        if (lastCmp !== 0) return lastCmp;
        return aFirst.localeCompare(bFirst, undefined, { sensitivity: 'base' });
      });
      if (!sortedTechs.length) {
        setTechUsers([
          { id: 9001, name: 'Jacob Daniels', email: 'jacob@b.com', role: 'tech' },
          { id: 9002, name: 'Sadie Percontra', email: 'sadie@b.com', role: 'tech' },
          { id: 9003, name: 'Chris Lane', email: 'chris@b.com', role: 'tech' },
        ] as any);
      } else {
        setTechUsers(sortedTechs);
      }
      setServiceRoutes(routesRes?.routes || []);
    } catch (err: any) {
      showBanner({ type: 'error', message: err?.message || 'Unable to load field techs.' });
    }
  };

  useEffect(() => {
    load();
  }, [token]);

  useEffect(() => {
    navigation.setOptions({
      title: showAll ? 'All Field Technicians' : 'Field Technicians',
      headerBackTitle: 'Back',
    });
  }, [navigation, showAll]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Clear temp password bubble and reload data when returning to this screen
      setLastTemp(null);
      load();
    });
    return unsubscribe;
  }, [navigation, token]);

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
      const trimmedPhone = phone.trim();
      const res = await adminCreateUser(token, {
        name: trimmedName,
        email: trimmedEmail,
        role: 'tech',
        phone: trimmedPhone || undefined,
      });
      if (res?.ok) {
        let temp = res.tempPassword;
        if (!temp || temp.length < 8) {
          temp = generateTempPassword(8);
          try {
            await adminSetUserPassword(token, { userId: res.user.id, newPassword: temp });
          } catch {}
        }
        setLastTemp({ name: res.user.name, password: temp });
        setName('');
        setEmail('');
        setPhone('');
        showBanner({ type: 'success', message: `Added ${res.user.name}. Share their temp password.` });
        await load();
      }
    } catch (err: any) {
      showBanner({ type: 'error', message: err?.message || 'Unable to add field tech.' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {!showAll && (
        <Card>
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
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="Phone"
            placeholderTextColor={colors.muted}
            keyboardType="phone-pad"
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
        </Card>
      )}
      <Card>
        <Text style={styles.subTitle}>{showAll ? 'All Field Techs' : 'Current Field Techs'}</Text>
        {techUsers.length === 0 ? (
          <Text style={styles.emptyCopy}>No field techs yet.</Text>
          ) : (
            <ScrollView
              style={showAll ? styles.listScrollFull : styles.listScroll}
              contentContainerStyle={styles.listScrollContent}
              nestedScrollEnabled
            >
              {techUsers.map(user => (
                <ListRow key={user.id} style={styles.listRow}>
                  <View style={{ flex: 1 }}>
                  <Text style={styles.listName}>
                    {truncateText(user.name, 32)}
                    {user.managed_password ? (
                      <Text style={styles.pwInline}> ({user.managed_password})</Text>
                    ) : null}
                  </Text>
                  <Text style={styles.listEmail}>{truncateText(user.email, 36)}</Text>
                  {(() => {
                    const assigned = serviceRoutes.filter(r => r.user_id === user.id).map(r => r.name);
                    if (assigned.length) {
                      return <Text style={styles.routeAssigned}>{`Assigned Route: ${assigned.join(', ')}`}</Text>;
                    }
                    return <Text style={styles.routeNone}>No route assigned yet.</Text>;
                  })()}
                </View>
                </ListRow>
            ))}
          </ScrollView>
          )}
      </Card>
    </ScrollView>
  );
}

function formatPossessive(name?: string | null) {
  if (!name) return '';
  const trimmed = name.trim();
  if (!trimmed) return '';
  return /s$/i.test(trimmed) ? `${trimmed}'` : `${trimmed}'s`;
}

function generateTempPassword(len: number): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

const styles = StyleSheet.create({
  container: { padding: spacing(4), gap: spacing(3) },
  subTitle: { fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'center' },
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
  listRow: { paddingTop: spacing(1.5), paddingVertical: 0 },
  listName: { fontWeight: '600', color: colors.text },
  listEmail: { color: colors.muted },
  routeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1), marginTop: spacing(0.5) },
  routePill: { borderColor: colors.primary, borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing(2), paddingVertical: spacing(0.5) },
  routePillText: { color: colors.primary, fontWeight: '600', fontSize: 12 },
  routeNone: { color: colors.muted, fontSize: 12 },
  routeAssigned: { color: colors.primary, fontWeight: '600', marginTop: spacing(0.5) },
  emptyCopy: { color: colors.muted },
  listScroll: { maxHeight: 320 },
  listScrollFull: { maxHeight: undefined },
  listScrollContent: { paddingVertical: spacing(1), gap: spacing(1) },
});
