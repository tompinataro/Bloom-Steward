import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Switch, TextInput, ScrollView, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigationTypes';
import { fetchVisit, submitVisit, Visit, markVisitInProgress } from '../api/client';
import { useAuth } from '../auth';
import LoadingOverlay from '../components/LoadingOverlay';
import ThemedButton from '../components/Button';
import Banner from '../components/Banner';
import { showBanner } from '../components/globalBannerBus';
import { colors, spacing } from '../theme';
import { enqueueSubmission } from '../offlineQueue';
import { addCompleted, addInProgress, removeInProgress } from '../completed';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { isSubmitDisabled } from '../logic/gates';

type Props = NativeStackScreenProps<RootStackParamList, 'VisitDetail'>;

export default function VisitDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { token } = useAuth();
  const [visit, setVisit] = useState<Visit | null>(null);
  const [timelyInstruction, setTimelyInstruction] = useState('');
  const [ack, setAck] = useState(false);
  const [checkInTs, setCheckInTs] = useState<string | null>(null);
  const [checkOutTs, setCheckOutTs] = useState<string | null>(null);
  const [noteToOffice, setNoteToOffice] = useState('');
  const [onSiteContact, setOnSiteContact] = useState('');
  const [odometerReading, setOdometerReading] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!token) return;
      setLoading(true);
      try {
        const res = await fetchVisit(id, token);
        setVisit(res.visit);
        navigation.setOptions({ title: res.visit.clientName });
        setTimelyInstruction(res.visit.timelyNote || '');
        setAck(false);
        setNoteToOffice('');
        setOnSiteContact('');
        setOdometerReading('');
        setCheckInTs(null);
        setCheckOutTs(null);
        setSubmitError(null);
        // mark visit as in progress as soon as it's opened
        try { await addInProgress(id); } catch {}
        try { await markVisitInProgress(id, token); } catch {}
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
      const requiresAck = !!timelyInstruction && timelyInstruction.trim().length > 0;
      const payload = {
        notes: noteToOffice || undefined,
        checklist: visit.checklist.map(c => ({ key: c.key, done: c.done })),
        timelyAck: requiresAck ? ack : undefined,
        timelyInstruction: timelyInstruction || undefined,
        checkInTs: checkInTs || undefined,
        checkOutTs: outTs,
        checkOutLoc: await getLocation(),
        noteToOffice: noteToOffice || undefined,
        onSiteContact: onSiteContact || undefined,
        odometerReading: odometerReading || undefined,
      };
      if (!checkOutTs) setCheckOutTs(outTs);
      setSubmitError(null);
      try {
        await submitVisit(visit.id, payload, token);
        await addCompleted(visit.id);
        await removeInProgress(visit.id);
        navigation.navigate('RouteList', { saved: true });
      } catch (e) {
        await enqueueSubmission(visit.id, payload);
        await addCompleted(visit.id);
        await removeInProgress(visit.id);
        navigation.navigate('RouteList', { savedOffline: true });
      }
    } catch (e: any) {
      const msg = e?.message ?? 'Submit failed';
      setSubmitError(msg);
      showBanner({ type: 'error', message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  async function getLocation(): Promise<{ lat: number; lng: number } | undefined> {
    try {
      let perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted) {
        const req = await Location.requestForegroundPermissionsAsync();
        perm = req;
      }
      if (!perm.granted) return undefined;
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        return { lat: pos.coords.latitude, lng: pos.coords.longitude };
      } catch {
        const last = await Location.getLastKnownPositionAsync({ requiredAccuracy: 1000 });
        if (last) return { lat: last.coords.latitude, lng: last.coords.longitude };
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  function formatTime(ts: string): string {
    try {
      const d = new Date(ts);
      // Prefer locale hour:minute without seconds; fallback to manual
      try {
        // Some RN environments support these options
        return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' } as any);
      } catch {
        const h = d.getHours();
        const m = d.getMinutes();
        const hh = ((h % 12) || 12).toString();
        const mm = m < 10 ? `0${m}` : `${m}`;
        const ampm = h < 12 ? 'AM' : 'PM';
        return `${hh}:${mm} ${ampm}`;
      }
    } catch {
      return '';
    }
  }

  if (loading && !visit) return <View style={styles.center}><ActivityIndicator /></View>;
  if (!visit) return <View style={styles.center}><Text>Visit not found</Text></View>;

  const requiresAck = !!timelyInstruction && timelyInstruction.trim().length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.content}>
          {submitError ? <Banner type="error" message={submitError} /> : null}
          <View style={styles.timelyCard}>
            <View style={styles.headerRow}>
              <Text style={styles.sectionTitle} numberOfLines={1}>Timely Notes</Text>
              {requiresAck ? (
                <View style={styles.ackInline}>
                  <Text style={styles.ackLabel}>Acknowledge</Text>
                  <Switch style={styles.ackSwitch} value={ack} onValueChange={setAck} />
                </View>
              ) : null}
            </View>
            <Text style={requiresAck ? styles.timelyCopy : styles.timelyPlaceholder}>
              {requiresAck ? timelyInstruction : 'No timely notes today.'}
            </Text>
          </View>
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
                  notes: noteToOffice || undefined,
                  checklist: visit.checklist.map(c => ({ key: c.key, done: c.done })),
                  timelyAck: requiresAck ? ack : undefined,
                  timelyInstruction: timelyInstruction || undefined,
                  checkInTs: ts,
                  checkInLoc: loc,
                  onSiteContact: onSiteContact || undefined,
                  odometerReading: odometerReading || undefined,
                } as any;
                try {
                  await submitVisit(visit.id, payload, token);
                } catch {
                  await enqueueSubmission(visit.id, payload);
                  showBanner({ type: 'info', message: 'Checked in offline - will sync when online' });
                }
              }}
              style={styles.checkInBtn}
            />
            <Text style={styles.timeText}>{checkInTs ? formatTime(checkInTs) : '--'}</Text>
          </View>
          {visit.checklist.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={styles.row}
              activeOpacity={0.7}
              onPress={() => setVisit((prev) => prev ? { ...prev, checklist: prev.checklist.map(c => c.key === item.key ? { ...c, done: !item.done } : c) } : prev)}
              accessibilityRole="button"
              accessibilityLabel={`Toggle ${item.label}`}
              accessibilityState={{ checked: item.done }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.label}>{item.label}</Text>
              <Switch value={item.done} onValueChange={(v) => setVisit((prev) => prev ? { ...prev, checklist: prev.checklist.map(c => c.key === item.key ? { ...c, done: v } : c) } : prev)} />
            </TouchableOpacity>
          ))}
          <View style={styles.headerRow}>
            <Text style={styles.sectionTitle}>Tech Visit Notes</Text>
          </View>
          <TextInput
            style={styles.notes}
            multiline
            numberOfLines={1}
            value={noteToOffice}
            onChangeText={setNoteToOffice}
            placeholder="Optional notes from the field to the office"
            placeholderTextColor={colors.muted}
          />
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>On-site contact</Text>
            <TextInput
              style={styles.textInput}
              value={onSiteContact}
              onChangeText={setOnSiteContact}
              placeholder="Who you met with (name, title, or phone)"
              placeholderTextColor={colors.muted}
              accessibilityLabel="On-site contact"
              returnKeyType="done"
            />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Odometer Reading</Text>
            <TextInput
              style={styles.textInput}
              value={odometerReading}
              onChangeText={setOdometerReading}
              placeholder="Enter current mileage"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              accessibilityLabel="Odometer reading"
              returnKeyType="done"
            />
          </View>
          <View style={{ height: spacing(14) }} />
        </View>
      </ScrollView>
      <SafeAreaView edges={['bottom']} style={styles.stickyBar}>
        <ThemedButton
          title={submitting ? 'Submitting...' : 'Check Out & Complete Visit'}
          onPress={() => { if (!checkOutTs) setCheckOutTs(new Date().toISOString()); onSubmit(); }}
          disabled={isSubmitDisabled({ submitting, checkInTs, requiresAck, ack })}
          style={styles.submitBtn}
        />
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
  notes: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card, borderWidth: 1, borderRadius: 8, paddingVertical: spacing(1.5), paddingHorizontal: spacing(3), minHeight: 52, textAlignVertical: 'top' },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: spacing(2) },
  nameRow: { alignItems: 'center', marginBottom: spacing(1) },
  clientName: { fontSize: 20, fontWeight: '700', color: colors.text, textAlign: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ackInline: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5), flexShrink: 0, marginTop: spacing(2) },
  ackLabel: { color: colors.text, fontSize: 17 },
  // Smaller switch to better fit inline with the label
  ackSwitch: { transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] },
  ackRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing(3), borderBottomColor: colors.border, borderBottomWidth: 1 },
  timelyCard: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, borderRadius: 10, padding: spacing(3), gap: spacing(2) },
  timelyCopy: { color: colors.text, fontSize: 16, lineHeight: 22 },
  timelyPlaceholder: { color: colors.muted, fontSize: 16 },
  submitBtn: { alignSelf: 'center', minWidth: 240, maxWidth: 360 },
  // Slightly raised so it sits ~half its height above the bottom edge
  stickyBar: { position: 'absolute', left: 0, right: 0, bottom: spacing(22), padding: spacing(3), paddingBottom: spacing(3.5), backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing(3) },
  checkInWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing(3), paddingVertical: spacing(2) },
  checkInBtn: { minWidth: 220 },
  // Larger, bolder time next to the Check In button
  timeText: { color: colors.muted, fontSize: 18, fontWeight: '700' },
  fieldGroup: { width: '100%', maxWidth: 360, gap: spacing(1) },
  fieldLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  textInput: {
    borderColor: colors.border,
    color: colors.text,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(3),
  },
});
