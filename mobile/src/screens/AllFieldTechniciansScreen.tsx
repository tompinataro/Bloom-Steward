import React, { useCallback, useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigationTypes';
import { useAuth } from '../auth';
import { adminFetchUsers, AdminUser } from '../api/client';
import { colors, spacing } from '../theme';
import { showBanner } from '../components/globalBannerBus';
import { useFocusEffect } from '@react-navigation/native';

type Props = NativeStackScreenProps<RootStackParamList, 'AllFieldTechnicians'>;

export default function AllFieldTechniciansScreen(_props: Props) {
  const { token } = useAuth();
  const [techs, setTechs] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await adminFetchUsers(token);
      setTechs((res?.users || []).filter(u => u.role === 'tech'));
    } catch (err: any) {
      showBanner({ type: 'error', message: err?.message || 'Unable to load technicians.' });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {loading ? (
        <Text style={styles.emptyCopy}>Loading…</Text>
      ) : techs.length === 0 ? (
        <Text style={styles.emptyCopy}>No field technicians yet.</Text>
      ) : (
        techs.map(tech => (
          <View key={tech.id} style={styles.row}>
            <Text style={styles.name}>
              {tech.name}
              {tech.managed_password ? (
                <Text style={styles.inlinePw}> ({tech.managed_password})</Text>
              ) : null}
            </Text>
            <Text style={styles.meta}>{tech.email}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing(4), gap: spacing(2) },
  row: {
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: spacing(3),
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing(0.5),
  },
  name: { fontSize: 18, fontWeight: '700', color: colors.text },
  inlinePw: { fontSize: 14, color: colors.muted },
  meta: { color: colors.muted, fontSize: 14 },
  emptyCopy: { color: colors.muted, textAlign: 'center', marginTop: spacing(6) },
});
