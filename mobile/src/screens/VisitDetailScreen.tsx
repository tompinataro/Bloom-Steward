import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Switch, Alert, TextInput, ScrollView, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { fetchVisit, submitVisit, Visit } from '../api/client';
import { useAuth } from '../auth';
import LoadingOverlay from '../components/LoadingOverlay';
import ThemedButton from '../components/Button';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'VisitDetail'>;

export default function VisitDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { token } = useAuth();
  const [visit, setVisit] = useState<Visit | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      if (!token) return;
      setLoading(true);
      try {
        const res = await fetchVisit(id, token);
        setVisit(res.visit);
        navigation.setOptions({ title: res.visit.clientName });
      } finally {
        setLoading(false);
      }
    })();
  }, [id, token]);

  const onSubmit = async () => {
    if (!token || !visit) return;
    setSubmitting(true);
    try {
      const payload = { notes, checklist: visit.checklist.map(c => ({ key: c.key, done: c.done })) };
      await submitVisit(visit.id, payload, token);
      // Haptics disabled unless dependency is installed; keep submit fast and silent
      navigation.navigate('RouteList', { saved: true });
    } catch (e: any) {
      Alert.alert('Submit failed', e?.message ?? String(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !visit) return <View style={styles.center}><ActivityIndicator /></View>;
  if (!visit) return <View style={styles.center}><Text>Visit not found</Text></View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.content}>
          {visit.checklist.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={styles.row}
              activeOpacity={0.7}
              onPress={() => setVisit((prev) => prev ? { ...prev, checklist: prev.checklist.map(c => c.key === item.key ? { ...c, done: !item.done } : c) } : prev)}
              accessibilityRole="button"
              accessibilityLabel={`Toggle ${item.label}`}
            >
              <Text style={styles.label}>{item.label}</Text>
              <Switch value={item.done} onValueChange={(v) => setVisit((prev) => prev ? { ...prev, checklist: prev.checklist.map(c => c.key === item.key ? { ...c, done: v } : c) } : prev)} />
            </TouchableOpacity>
          ))}
          <Text style={styles.label}>Notes</Text>
          <TextInput style={styles.notes} multiline value={notes} onChangeText={setNotes} placeholder="Optional notes" placeholderTextColor={colors.muted} />
          <View style={{ height: spacing(14) }} />
        </View>
      </ScrollView>
      <View style={styles.stickyBar}>
        <ThemedButton title={submitting ? 'Submitting…' : 'Submit'} onPress={onSubmit} disabled={submitting} style={styles.fullWidthBtn} />
      </View>
      <LoadingOverlay visible={loading || submitting} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: spacing(4) },
  content: { width: '100%', maxWidth: 360, alignSelf: 'center', gap: spacing(3) },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing(4), borderBottomColor: colors.border, borderBottomWidth: 1 },
  label: { fontSize: 17, color: colors.text },
  notes: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card, borderWidth: 1, borderRadius: 8, padding: spacing(3), minHeight: 100 },
  fullWidthBtn: { alignSelf: 'stretch' },
  stickyBar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing(4), backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border }
});
