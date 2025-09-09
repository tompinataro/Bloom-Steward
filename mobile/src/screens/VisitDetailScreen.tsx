import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Switch, TextInput, ScrollView, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigationTypes';
import { fetchVisit, submitVisit, Visit } from '../api/client';
import { useAuth } from '../auth';
import LoadingOverlay from '../components/LoadingOverlay';
import ThemedButton from '../components/Button';
import Banner from '../components/Banner';
import { colors, spacing } from '../theme';
import { enqueueSubmission } from '../offlineQueue';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';

type Props = NativeStackScreenProps<RootStackParamList, 'VisitDetail'>;

export default function VisitDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { token } = useAuth();
  const [visit, setVisit] = useState<Visit | null>(null);
  const [timelyNotes, setTimelyNotes] = useState('');
  const [ack, setAck] = useState(false);
  const [checkInTs, setCheckInTs] = useState<string | null>(null);
  const [checkOutTs, setCheckOutTs] = useState<string | null>(null);
  const [noteToOffice, setNoteToOffice] = useState('');
  const [showTechNotes, setShowTechNotes] = useState(false);
  const [techNotes, setTechNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [checkInQueued, setCheckInQueued] = useState(false);

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
      const outTs = checkOutTs || new Date().toISOString();
      const payload = {
        notes: timelyNotes,
        checklist: visit.checklist.map(c => ({ key: c.key, done: c.done })),
        timelyAck: ack,
        checkInTs: checkInTs || undefined,
        checkOutTs: outTs,
        noteToOffice: noteToOffice || undefined,
        techNotes: techNotes || undefined,
      };
      if (!checkOutTs) setCheckOutTs(outTs);
      setSubmitError(null);
      try {
        await submitVisit(visit.id, payload, token);
        navigation.navigate('RouteList', { saved: true });
      } catch (e) {
        await enqueueSubmission(visit.id, payload);
        navigation.navigate('RouteList', { savedOffline: true });
      }
    } catch (e: any) {
      setSubmitError(e?.message ?? 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  async function getLocation(): Promise<{ lat: number; lng: number } | undefined> {
    try {
      const status = await Location.getForegroundPermissionsAsync();
      if (!status.granted) return undefined;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch {
      return undefined;
    }
  }

  if (loading && !visit) return <View style={styles.center}><ActivityIndicator /></View>;
  if (!visit) return <View style={styles.center}><Text>Visit not found</Text></View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.content}>
          {submitError ? <Banner type="error" message={submitError} /> : null}
          <View style={styles.headerRow}>
            <Text style={styles.sectionTitle}>Timely Notes</Text>
            <View style={styles.ackInline}>
              <Text style={styles.ackLabel}>Acknowledge</Text>
              <Switch value={ack} onValueChange={setAck} />
            </View>
          </View>
          {/* For reference only: In practice Timely Notes may not appear unless needed. */}
          <TextInput
            style={styles.notes}
            multiline
            numberOfLines={1}
            value={timelyNotes}
            onChangeText={setTimelyNotes}
            placeholder=" Urgent issues, if necessary, will appear here."
            placeholderTextColor={colors.muted}
          />
          <View style={styles.checkInWrap}>
            <ThemedButton
              title={checkInTs ? 'Checked In' : 'Check In'}
              onPress={async () => {
                if (checkInTs) return;
                const ts = new Date().toISOString();
                setCheckInTs(ts);
                if (!token || !visit) return;
                const loc = await getLocation();
                const payload = {
                  notes: timelyNotes,
                  checklist: visit.checklist.map(c => ({ key: c.key, done: c.done })),
                  timelyAck: ack,
                  checkInTs: ts,
                  checkInLoc: loc,
                } as any;
                try {
                  await submitVisit(visit.id, payload, token);
                } catch {
                  await enqueueSubmission(visit.id, payload);
                  setCheckInQueued(true);
                  setTimeout(() => setCheckInQueued(false), 3000);
                }
              }}
              style={styles.checkInBtn}
            />
            <Text style={styles.timeText}>{checkInTs ? new Date(checkInTs).toLocaleTimeString() : '—'}</Text>
          </View>
          {checkInQueued ? <Banner type="info" message="Checked in offline — will sync when online" /> : null}
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
          <View style={styles.headerRow}>
            <Text style={styles.sectionTitle}>Note to Office</Text>
          </View>
          <TextInput
            style={styles.notes}
            multiline
            numberOfLines={1}
            value={noteToOffice}
            onChangeText={setNoteToOffice}
            placeholder=" Add a quick note to office (optional)"
            placeholderTextColor={colors.muted}
          />

          {/* Providing an option for field techs to provide written feedback by clicking a button labeled "Tech Visit Notes" provides for a complete 360-degree communications loop. */}
          <View style={styles.headerRow}>
            <Text style={styles.sectionTitle}>Tech Visit Notes</Text>
          </View>
          <ThemedButton
            title={showTechNotes ? 'Hide Tech Visit Notes' : 'Tech Visit Notes'}
            variant={showTechNotes ? 'outline' : 'primary'}
            onPress={() => setShowTechNotes(prev => !prev)}
            style={styles.techNotesBtn}
          />
          {showTechNotes ? (
            <TextInput
              style={styles.notes}
              multiline
              numberOfLines={1}
              value={techNotes}
              onChangeText={setTechNotes}
              placeholder=" Enter any visit feedback for the office"
              placeholderTextColor={colors.muted}
            />
          ) : null}
          <View style={{ height: spacing(14) }} />
        </View>
      </ScrollView>
      <SafeAreaView edges={['bottom']} style={styles.stickyBar}>
        <ThemedButton title={submitting ? 'Submitting…' : 'Check Out & Complete Visit'} onPress={() => { if (!checkOutTs) setCheckOutTs(new Date().toISOString()); onSubmit(); }} disabled={submitting || !ack || !checkInTs} style={styles.submitBtn} />
      </SafeAreaView>
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
  notes: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card, borderWidth: 1, borderRadius: 8, paddingVertical: spacing(1.5), paddingHorizontal: spacing(3), height: 44, textAlignVertical: 'center' },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: spacing(2) },
  nameRow: { alignItems: 'center', marginBottom: spacing(1) },
  clientName: { fontSize: 20, fontWeight: '700', color: colors.text, textAlign: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ackInline: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  ackLabel: { color: colors.text },
  techNotesBtn: { alignSelf: 'center', minWidth: 200, marginTop: spacing(2) },
  ackRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing(3), borderBottomColor: colors.border, borderBottomWidth: 1 },
  submitBtn: { alignSelf: 'center', minWidth: 240, maxWidth: 360 },
  stickyBar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing(3), paddingBottom: spacing(5), backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing(3) },
  checkInWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing(3), paddingVertical: spacing(2) },
  checkInBtn: { minWidth: 220 },
  timeText: { color: colors.muted }
});
