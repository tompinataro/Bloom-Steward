import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable, Share } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigationTypes';
import { useAuth } from '../auth';
import { adminFetchUsers, adminFetchServiceRoutes, AdminUser, ServiceRoute } from '../api/client';
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
              <Pressable
                key={user.id}
                style={styles.row}
                onPress={() => {
                  if (assignedRoute) {
                    navigation.navigate('ServiceRoutes', { focusRouteId: assignedRoute.id });
                  } else {
                    showBanner({ type: 'info', message: `${user.name} has no assigned route yet.` });
                  }
                }}
              >
                <Text style={styles.name}>{truncateText(user.name, 40)}</Text>
                <Text style={styles.email}>{truncateText(`${user.email}${user.managed_password ? ` (${user.managed_password})` : ''}`, 56)}</Text>
                <Text style={styles.routeLabel}>
                  {assignedRoute ? `Assigned Route: ${assignedRoute.name}` : 'Unassigned'}
                </Text>
              </Pressable>
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
  row: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingVertical: spacing(1.5), gap: spacing(0.25) },
  name: { fontWeight: '700', color: colors.text },
  email: { color: colors.muted, fontSize: 13 },
  routeLabel: { color: colors.primary, fontWeight: '600' },
});
