import React, { useEffect, useMemo, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Switch, TextInput, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
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
import { isSubmitDisabled } from '../logic/gates';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  const checkInKey = useMemo(() => `visit-checkin-ts:${id}`, [id]);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutoSavePayload = useRef<string>('');

  useEffect(() => {
    (async () => {
      if (!token) return;
      setLoading(true);
      try {
        const res = await fetchVisit(id, token);
        setVisit(res.visit);
        navigation.setOptions({ title: `Today at ${res.visit.clientName}` });
        setTimelyInstruction(res.visit.timelyNote || '');
        setAck(false);
        setNoteToOffice('');
        setOnSiteContact('');
        setOdometerReading('');
        const persistedTs = await AsyncStorage.getItem(checkInKey);
        setCheckInTs(persistedTs ?? res.visit?.checkInTs ?? null);
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
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }
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
        await AsyncStorage.removeItem(checkInKey);
        setCheckInTs(null);
      try {
        await submitVisit(visit.id, payload, token);
        await addCompleted(visit.id);
        await removeInProgress(visit.id);
        navigation.navigate('RouteList', { saved: true });
      } catch (e) {
        await enqueueSubmission(visit.id, payload);
        await addCompleted(visit.id);
        await removeInProgress(visit.id);
        await AsyncStorage.removeItem(checkInKey);
        setCheckInTs(null);
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

  useEffect(() => {
    if (!token || !visit || !checkInTs || checkOutTs || submitting) return;
    const requiresAck = !!timelyInstruction && timelyInstruction.trim().length > 0;
    const payload = {
      notes: noteToOffice || undefined,
      checklist: visit.checklist.map(c => ({ key: c.key, done: c.done })),
      timelyAck: requiresAck ? ack : undefined,
      timelyInstruction: timelyInstruction || undefined,
      checkInTs: checkInTs || undefined,
      noteToOffice: noteToOffice || undefined,
      onSiteContact: onSiteContact || undefined,
      odometerReading: odometerReading || undefined,
    };
    const payloadKey = JSON.stringify(payload);
    if (payloadKey === lastAutoSavePayload.current) return;
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }
    autoSaveTimer.current = setTimeout(async () => {
      if (!token || !visit || !checkInTs || checkOutTs) return;
      const key = JSON.stringify(payload);
      if (key === lastAutoSavePayload.current) return;
      lastAutoSavePayload.current = key;
      try {
        await submitVisit(visit.id, payload, token);
      } catch {
        await enqueueSubmission(visit.id, payload);
      }
    }, 900);
    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = null;
      }
    };
  }, [token, visit, checkInTs, checkOutTs, noteToOffice, onSiteContact, odometerReading, ack, timelyInstruction, submitting]);

  async function getLocation(): Promise<{ lat: number; lng: number } | undefined> {
    // Location prompts are temporarily suppressed until admins opt back in.
    return undefined;
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
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: spacing(36) }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          {submitError ? <Banner type="error" message={submitError} /> : null}
          <Text style={styles.sectionTitle}>Timely Notes</Text>
          <View style={styles.timelyCard}>
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }} />
              {requiresAck ? (
                <View style={styles.ackInline}>
                  <Text style={styles.ackLabel}>Acknowledge</Text>
                  <Switch style={styles.ackSwitch} value={ack} onValueChange={setAck} />
                </View>
              ) : null}
            </View>
            <Text style={[requiresAck ? styles.timelyCopy : styles.timelyPlaceholder, styles.timelyText]}>
              {requiresAck ? timelyInstruction : 'Any notes from the office will appear here.'}
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
                const nextTs = ts;
                const payload = {
                  notes: noteToOffice || undefined,
                  checklist: visit.checklist.map(c => ({ key: c.key, done: c.done })),
                  timelyAck: requiresAck ? ack : undefined,
                  timelyInstruction: timelyInstruction || undefined,
                  checkInTs: nextTs,
                  checkInLoc: loc,
                  onSiteContact: onSiteContact || undefined,
                  odometerReading: odometerReading || undefined,
                } as any;
                try {
                  await submitVisit(visit.id, payload, token);
                  lastAutoSavePayload.current = JSON.stringify(payload);
                  setCheckInTs(nextTs);
                  await AsyncStorage.setItem(checkInKey, nextTs);
                } catch {
                  await enqueueSubmission(visit.id, payload);
                  lastAutoSavePayload.current = JSON.stringify(payload);
                  showBanner({ type: 'info', message: 'Checked in offline - will sync when online' });
                  await AsyncStorage.setItem(checkInKey, nextTs);
                }
              }}
              style={styles.checkInBtn}
            />
            <Text style={styles.timeText}>{checkInTs ? formatTime(checkInTs) : '--'}</Text>
          </View>
          <View style={styles.checklistCard}>
            {visit.checklist.map((item, idx) => (
              <TouchableOpacity
                key={item.key}
                style={[styles.row, idx === visit.checklist.length - 1 ? styles.rowLast : null]}
                activeOpacity={0.7}
                onPress={() => setVisit((prev) => prev ? { ...prev, checklist: prev.checklist.map(c => c.key === item.key ? { ...c, done: !item.done } : c) } : prev)}
                accessibilityRole="button"
                accessibilityLabel={`Toggle ${item.label}`}
                accessibilityState={{ checked: item.done }}
                hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
              >
                <Text style={styles.label}>{item.label}</Text>
              <TouchableOpacity
                accessibilityRole="switch"
                accessibilityState={{ checked: item.done }}
                onPress={() => setVisit((prev) => prev ? { ...prev, checklist: prev.checklist.map(c => c.key === item.key ? { ...c, done: !item.done } : c) } : prev)}
                style={styles.switchShell}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              >
                <View style={[styles.switchTrack, item.done && styles.switchTrackOn]}>
                  <View style={[
                    styles.switchThumb,
                    item.done ? styles.switchThumbOn : styles.switchThumbOff
                  ]} />
                </View>
              </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.sectionTitle}>On-site Contact Name</Text>
            <TextInput
              style={styles.textInput}
              value={onSiteContact}
              onChangeText={setOnSiteContact}
              placeholder="Check-in during each visit, enter name here."
              placeholderTextColor={colors.muted}
              accessibilityLabel="On-site contact"
              returnKeyType="done"
            />
          </View>
          <View style={styles.headerRow}>
            <Text style={styles.sectionTitle}>Tech Visit Notes</Text>
          </View>
          <TextInput
            style={styles.notes}
            multiline
            numberOfLines={1}
            value={noteToOffice}
            onChangeText={setNoteToOffice}
            placeholder="Optional notes from the field to the office."
            placeholderTextColor={colors.muted}
          />
          <View style={styles.fieldGroup}>
            <Text style={styles.sectionTitle}>Odometer Reading</Text>
            <TextInput
              style={styles.textInput}
              value={odometerReading}
              onChangeText={setOdometerReading}
              placeholder="Enter current mileage"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              accessibilityLabel="Odometer reading"
              returnKeyType="done"
              blurOnSubmit
            />
          </View>
        </View>
      </ScrollView>
      <SafeAreaView edges={['bottom']} style={styles.stickyBar}>
        <ThemedButton
          title={submitting ? 'Submitting...' : 'Check Out & Complete Visit'}
          onPress={() => { if (!checkOutTs) setCheckOutTs(new Date().toISOString()); onSubmit(); }}
          disabled={isSubmitDisabled({ submitting, checkInTs, requiresAck, ack, checklist: visit?.checklist || [] })}
          style={styles.submitBtn}
        />
      </SafeAreaView>
      <LoadingOverlay visible={loading || submitting} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: spacing(4) },
  content: { width: '100%', maxWidth: 360, alignSelf: 'center', gap: spacing(3) },
  checklistCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.card, paddingVertical: spacing(1.2) },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing(1.8), borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing(4) },
  rowLast: { borderBottomWidth: 0 },
  label: { fontSize: 16, color: colors.text },
  notes: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card, borderWidth: 1, borderRadius: 8, paddingVertical: spacing(1.5), paddingHorizontal: spacing(3), minHeight: 52, textAlignVertical: 'top', fontSize: 16 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: spacing(2) },
  nameRow: { alignItems: 'center', marginBottom: spacing(1) },
  clientName: { fontSize: 20, fontWeight: '700', color: colors.text, textAlign: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ackInline: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5), flexShrink: 0, marginTop: spacing(2) },
  ackLabel: { color: colors.text, fontSize: 17 },
  // Smaller switch to better fit inline with the label
  ackSwitch: { transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] },
  ackRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing(3), borderBottomColor: colors.border, borderBottomWidth: 1 },
  timelyCard: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, borderRadius: 10, paddingHorizontal: spacing(3), paddingTop: spacing(1), paddingBottom: spacing(2), gap: spacing(1.25) },
  timelyCopy: { color: colors.text, fontSize: 16, lineHeight: 22 },
  timelyPlaceholder: { color: colors.muted, fontSize: 16 },
  timelyText: { paddingHorizontal: spacing(0.5), lineHeight: 20, marginTop: spacing(0.25) },
  submitBtn: { alignSelf: 'center', minWidth: 240, maxWidth: 360 },
  // Slightly raised so it sits ~half its height above the bottom edge
  stickyBar: { position: 'absolute', left: 0, right: 0, bottom: spacing(2), padding: spacing(3), paddingBottom: spacing(3.5), backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing(3) },
  checkInWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing(3), paddingVertical: spacing(2) },
  checkInBtn: { minWidth: 220 },
  // Larger, bolder time next to the Check In button
  timeText: { color: colors.muted, fontSize: 18, fontWeight: '700' },
  fieldGroup: { width: '100%', maxWidth: 360, gap: spacing(1) },
  textInput: {
    borderColor: colors.border,
    color: colors.text,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(3),
    fontSize: 16,
  },
  switchShell: { paddingVertical: spacing(0.25), paddingHorizontal: spacing(0.25) },
  switchTrack: {
    width: 36,
    height: 16,
    borderRadius: 999,
    backgroundColor: '#d1d5db',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  switchTrackOn: { backgroundColor: colors.primary },
  switchThumb: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  switchThumbOn: { alignSelf: 'flex-end' },
  switchThumbOff: { alignSelf: 'flex-start' },
});
