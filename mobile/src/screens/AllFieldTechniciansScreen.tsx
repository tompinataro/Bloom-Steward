import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable, Share, Linking } from 'react-native';
import * as MailComposer from 'expo-mail-composer';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { RootStackParamList } from '../navigationTypes';
import { useAuth } from '../auth';
import { adminFetchUsers, adminFetchServiceRoutes, adminClearRoutesForTech, AdminUser, ServiceRoute } from '../api/client';
import { showBanner } from '../components/globalBannerBus';
import { colors, spacing } from '../theme';
import ThemedButton from '../components/Button';
import { truncateText } from '../utils/text';

type Props = NativeStackScreenProps<RootStackParamList, 'AllFieldTechnicians'>;

export default function AllFieldTechniciansScreen({ navigation }: Props) {
  const { token, user } = useAuth();
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

  useFocusEffect(
    React.useCallback(() => {
      // Refresh list whenever returning to this screen
      load();
      return () => {};
    }, [token])
  );

  const getRouteForTech = (userId: number) =>
    routes.find(r => r.user_id === userId || (r as any)?.assigned_user_id === userId);

  const shareTechs = async () => {
    if (!techs.length) {
      showBanner({ type: 'info', message: 'No field technicians to share yet.' });
      return;
    }
    const lines = techs.map(t => {
      const assignedRoute = getRouteForTech(t.id);
      const routeName = assignedRoute ? assignedRoute.name : 'Unassigned';
      return `${t.name}\nEmail: ${t.email}${t.phone ? `\nPhone: ${t.phone}` : ''}\nRoute: ${routeName}`;
    });
    const subject = 'Field Technicians';
    const body = `Field Technicians:\n\n${lines.join('\n\n')}`;
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
      await Share.share({ title: subject, message: body });
    } catch {}
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <View style={styles.headerRow}>
              <Text style={styles.title}>All Field Technicians</Text>
              {techs.length > 0 ? (
                <Pressable style={styles.shareChip} onPress={shareTechs}>
                  <Text style={styles.shareChipText}>Email This List</Text>
                </Pressable>
              ) : null}
            </View>
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
                    {assignedRoute ? `Assigned Route(s) = "${assignedRoute.name}"` : 'Assigned Route(s) = "Unassigned"'}
                  </Text>
                </View>
                <View style={styles.actionsRow}>
                  <Pressable
                    style={styles.editBtn}
                    onPress={() => (navigation as any)?.navigate?.('EditFieldTech', { user })}
                  >
                    <Text style={styles.editBtnText}>Edit</Text>
                  </Pressable>
                  {user?.role === 'admin' ? (
                    <Pressable
                      style={styles.clearBtn}
                      onPress={async () => {
                        if (!token) return;
                        try {
                          await adminClearRoutesForTech(token, Number(user.id));
                          showBanner({ type: 'success', message: `Cleared today's route for ${user.name}.` });
                        } catch (err: any) {
                          showBanner({ type: 'error', message: err?.message || 'Unable to clear route.' });
                        }
                      }}
                    >
                      <Text style={styles.clearBtnText}>Clear Today’s Route</Text>
                    </Pressable>
                  ) : null}
                </View>
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
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  empty: { color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingVertical: spacing(1.5), gap: spacing(2) },
  infoColumn: { flex: 1, gap: spacing(0.25) },
  name: { fontWeight: '700', color: colors.text },
  email: { color: colors.muted, fontSize: 13 },
  routeLabel: { color: colors.primary, fontWeight: '600' },
  editBtn: { paddingVertical: spacing(1), paddingHorizontal: spacing(2), borderRadius: 8, borderWidth: 1, borderColor: colors.primary, backgroundColor: 'transparent' },
  editBtnText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1) },
  clearBtn: { paddingVertical: spacing(1), paddingHorizontal: spacing(2), borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: 'transparent' },
  clearBtnText: { color: colors.text, fontWeight: '600', fontSize: 14 },
  phone: { color: colors.text },
  shareChip: { alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.primary, borderRadius: 999, paddingHorizontal: spacing(2), paddingVertical: spacing(0.5) },
  shareChipText: { color: colors.primary, fontWeight: '600', fontSize: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
