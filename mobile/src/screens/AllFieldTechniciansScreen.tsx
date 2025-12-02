import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable, Share } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
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
  const getRouteForTech = (userId: string) => routes.find(r => r.assigned_user_id === userId);

  useEffect(() => {
    load();
  }, [token]);

  useFocusEffect(
    React.useCallback(() => {
      // Refresh list whenever returning to this screen
      load();
      return () => {};
    }, [token])
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>All Field Technicians</Text>
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
                  onPress={() => (navigation as any)?.navigate?.('EditFieldTech', { user })}
                >
                  <Text style={styles.editBtnText}>Edit</Text>
                </Pressable>
              </View>
            );
          })
        )}
      </View>
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
  phone: { color: colors.text },
});
