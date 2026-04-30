import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigationTypes';
import { AdminClient, AdminUser, fetchAdminClients, fetchAdminUsers } from '../api/client';
import { useAuth } from '../auth';
import Banner from '../components/Banner';
import ThemedButton from '../components/Button';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Admin'>;

export default function AdminScreen(_props: Props) {
  const { token, signOut } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [usersRes, clientsRes] = await Promise.all([
        fetchAdminUsers(token),
        fetchAdminClients(token),
      ]);
      setUsers(usersRes.users);
      setClients(clientsRes.clients);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load admin demo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [token]);

  const rows = [
    { key: 'fieldTechs', title: 'Field Techs', count: users.length, detail: users.map(u => u.name).join(', ') },
    { key: 'clients', title: 'Client Sites', count: clients.length, detail: clients.map(c => c.name).join(', ') },
    { key: 'assignments', title: 'Route Assignments', count: clients.length, detail: 'Today demo route assigned to Jacob' },
  ];

  return (
    <View style={styles.container}>
      {error ? (
        <View style={styles.errorWrap}>
          <Banner type="error" message={error} />
          <ThemedButton title="Retry" variant="outline" onPress={load} style={styles.retryBtn} />
        </View>
      ) : null}
      {loading ? (
        <ActivityIndicator style={styles.loader} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={item => item.key}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.count}>{item.count}</Text>
              </View>
              <Text style={styles.detail}>{item.detail || 'Ready for demo data'}</Text>
            </View>
          )}
        />
      )}
      <View style={styles.stickyBar}>
        <ThemedButton title="Sign Off" onPress={signOut} style={styles.submitBtn} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  listContent: { padding: spacing(4), paddingBottom: spacing(28) },
  loader: { marginTop: spacing(12) },
  errorWrap: { paddingHorizontal: spacing(4), marginTop: spacing(2) },
  retryBtn: { alignSelf: 'flex-start', marginTop: spacing(2) },
  card: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    padding: spacing(4),
    backgroundColor: colors.card,
    borderRadius: 8,
    marginBottom: spacing(3),
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing(3) },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700', flex: 1 },
  count: { color: colors.primary, fontSize: 24, fontWeight: '800' },
  detail: { color: colors.muted, marginTop: spacing(2), lineHeight: 20 },
  stickyBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: spacing(4),
    padding: spacing(3),
    paddingBottom: spacing(5),
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  submitBtn: { alignSelf: 'center', minWidth: 240, maxWidth: 360 },
});
