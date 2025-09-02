import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Switch, Button, Alert, TextInput, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { fetchVisit, submitVisit, Visit } from '../api/client';
import { useAuth } from '../auth';
import LoadingOverlay from '../components/LoadingOverlay';

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
      Alert.alert('Submitted', 'Visit saved');
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
    <>
    <ScrollView contentContainerStyle={styles.container}>
      {visit.checklist.map((item) => (
        <View key={item.key} style={styles.row}>
          <Text style={styles.label}>{item.label}</Text>
          <Switch value={item.done} onValueChange={(v) => setVisit((prev) => prev ? { ...prev, checklist: prev.checklist.map(c => c.key === item.key ? { ...c, done: v } : c) } : prev)} />
        </View>
      ))}
      <Text style={styles.label}>Notes</Text>
      <TextInput style={styles.notes} multiline value={notes} onChangeText={setNotes} placeholder="Optional notes" />
      <Button title={submitting ? 'Submitting...' : 'Submit'} onPress={onSubmit} disabled={submitting} />
    </ScrollView>
    <LoadingOverlay visible={loading || submitting} />
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomColor: '#eee', borderBottomWidth: 1 },
  label: { fontSize: 16 },
  notes: { borderColor: '#ccc', borderWidth: 1, borderRadius: 6, padding: 10, minHeight: 100 }
});
