import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Pressable, Modal } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigationTypes';
import { useAuth } from '../auth';
import ThemedButton from '../components/Button';
import { colors, spacing } from '../theme';
import { showBanner } from '../components/globalBannerBus';
import { adminFetchReportSummary, adminSendReport, ReportSummaryRow } from '../api/client';
import { truncateText } from '../utils/text';

const FREQUENCIES = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Pay Period', value: 'payperiod' },
  { label: 'Monthly', value: 'monthly' },
];

type FrequencyValue = typeof FREQUENCIES[number]['value'];

type RecipientTarget = {
  id: string;
  email: string;
  frequency: FrequencyValue;
};

const newRecipient = (): RecipientTarget => ({
  id: `rec-${Math.random().toString(36).slice(2)}-${Date.now()}`,
  email: '',
  frequency: 'weekly',
});

type Props = NativeStackScreenProps<RootStackParamList, 'Reports'>;

export default function ReportsScreen(_props: Props) {
  const { token, user } = useAuth();
  const [recipients, setRecipients] = useState<RecipientTarget[]>([newRecipient()]);
  const [frequencyPicker, setFrequencyPicker] = useState<RecipientTarget | null>(null);
  const [previewFrequency, setPreviewFrequency] = useState<FrequencyValue>('weekly');
  const [summary, setSummary] = useState<ReportSummaryRow[]>([]);
  const [rangeText, setRangeText] = useState('—');
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [sending, setSending] = useState(false);

  const fetchSummary = async () => {
    if (!token) return;
    setLoadingSummary(true);
    try {
      const res = await adminFetchReportSummary(token, { frequency: previewFrequency });
      setSummary(res.rows || []);
      setRangeText(`${formatDate(res.range.start)} – ${formatDate(res.range.end)}`);
    } catch (err: any) {
      showBanner({ type: 'error', message: err?.message || 'Unable to fetch report.' });
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [token, previewFrequency]);

  useEffect(() => {
    if (!user?.email) return;
    setRecipients((prev) => {
      const existing = prev.map((r) => r.email.toLowerCase());
      if (existing.includes(user.email.toLowerCase())) return prev;
      const next = [...prev];
      if (next.length && next[0].email.trim() === '') {
        next[0] = { ...next[0], email: user.email };
        return next;
      }
      return [{ ...newRecipient(), email: user.email }, ...next];
    });
  }, [user?.email]);

  const updateRecipient = (id: string, patch: Partial<RecipientTarget>) => {
    setRecipients(prev => prev.map(rec => (rec.id === id ? { ...rec, ...patch } : rec)));
  };

  const addRecipient = () => setRecipients(prev => [...prev, newRecipient()]);

  const removeRecipient = (id: string) => {
    setRecipients(prev => {
      if (prev.length <= 1) {
        return prev.map((rec, idx) => (idx === 0 ? { ...rec, email: '' } : rec));
      }
      return prev.filter(rec => rec.id !== id);
    });
  };

  const sendReport = async () => {
    if (!token) return;
    const cleaned = recipients
      .map(rec => ({ ...rec, email: rec.email.trim() }))
      .filter(rec => !!rec.email);
    if (!cleaned.length) {
      showBanner({ type: 'error', message: 'Add at least one recipient email.' });
      return;
    }
    const grouped = cleaned.reduce<Record<string, string[]>>((acc, rec) => {
      if (!acc[rec.frequency]) acc[rec.frequency] = [];
      acc[rec.frequency].push(rec.email);
      return acc;
    }, {});
    const entries = Object.entries(grouped);
    if (!entries.length) {
      showBanner({ type: 'error', message: 'Add at least one recipient email.' });
      return;
    }
    setSending(true);
    try {
      for (const [freq, emails] of entries) {
        if (!emails.length) continue;
        await adminSendReport(token, { frequency: freq, emails });
      }
      showBanner({ type: 'success', message: 'Report email(s) sent.' });
    } catch (err: any) {
      showBanner({ type: 'error', message: err?.message || 'Unable to send report.' });
    } finally {
      setSending(false);
    }
  };

  const summaryHeaders = useMemo(() => [
    'Technician',
    'Route',
    'Client',
    'Address',
    'Check-In',
    'Check-Out',
    'Time On-site',
    'Mileage',
    'On-site Contact',
    'Geo ft',
    'Geo Valid',
  ], []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.heading}>Report Generator</Text>
        <Text style={styles.label}>Recipients</Text>
        <View style={styles.recipientStack}>
          {recipients.map(rec => (
            <View key={rec.id} style={styles.recipientRow}>
              <TextInput
                style={styles.recipientInput}
                value={rec.email}
                onChangeText={text => updateRecipient(rec.id, { email: text })}
                placeholder="admin@example.com"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <Pressable
                style={styles.frequencyPicker}
                onPress={() => setFrequencyPicker(rec)}
              >
                <Text style={styles.frequencyPickerText}>{labelFor(rec.frequency)}</Text>
              </Pressable>
              <Pressable style={styles.removeRecipient} onPress={() => removeRecipient(rec.id)}>
                <Text style={styles.removeRecipientText}>×</Text>
              </Pressable>
            </View>
          ))}
        </View>
        <ThemedButton title="Add Recipient" variant="outline" onPress={addRecipient} />

        <Text style={styles.label}>Preview Frequency</Text>
        <View style={styles.frequencyRow}>
          {FREQUENCIES.map(freq => (
            <Pressable
              key={freq.value}
              style={[styles.frequencyBtn, previewFrequency === freq.value && styles.frequencyBtnActive]}
              onPress={() => setPreviewFrequency(freq.value as FrequencyValue)}
            >
              <Text style={[styles.frequencyText, previewFrequency === freq.value && styles.frequencyTextActive]}>
                {freq.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.rangeText}>Range: {rangeText}</Text>
        <View style={styles.actionRow}>
          <ThemedButton
            title={loadingSummary ? 'Loading…' : 'Refresh Preview'}
            onPress={fetchSummary}
            disabled={loadingSummary}
            style={styles.actionButton}
          />
          <ThemedButton
            title={sending ? 'Sending…' : 'Email Report'}
            onPress={sendReport}
            disabled={sending}
            style={[styles.actionButton, styles.sendBtn]}
          />
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.heading}>Summary Preview</Text>
        {summary.length === 0 ? (
          <Text style={styles.muted}>{loadingSummary ? 'Loading…' : 'No visits recorded for this range.'}</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View>
              <View style={[styles.tableRow, styles.tableHeaderRow]}>
                <Text numberOfLines={1} style={[styles.cell, styles.technician, styles.headerCell]}>Technician</Text>
                <Text numberOfLines={1} style={[styles.cell, styles.route, styles.headerCell]}>Route</Text>
                <Text numberOfLines={1} style={[styles.cell, styles.client, styles.headerCell]}>Client</Text>
                <Text numberOfLines={1} style={[styles.cell, styles.address, styles.headerCell]}>Address</Text>
                <Text numberOfLines={1} style={[styles.cell, styles.checkIn, styles.headerCell]}>Check-In</Text>
                <Text numberOfLines={1} style={[styles.cell, styles.checkOut, styles.headerCell]}>Check-Out</Text>
                <Text numberOfLines={1} style={[styles.cell, styles.duration, styles.headerCell]}>Duration</Text>
                <Text numberOfLines={1} style={[styles.cell, styles.mileage, styles.headerCell]}>Mileage</Text>
                <Text numberOfLines={1} style={[styles.cell, styles.contact, styles.headerCell]}>Contact</Text>
                <Text numberOfLines={1} style={[styles.cell, styles.geoValid, styles.headerCell]}>Geo Valid</Text>
              </View>
                {summary.map((item, index) => (
                  <View key={`${item.techId}-${item.clientName}-${index}`} style={styles.tableRow}>
                    <Text numberOfLines={1} style={[styles.cell, styles.technician]}>{truncateText(item.techName, 14)}</Text>
                    <Text numberOfLines={1} style={[styles.cell, styles.route]}>{item.routeName || '—'}</Text>
                    <View style={[styles.clientCell]}>
                      <View
                        style={[
                          styles.geoDot,
                          item.geoValidated === true ? styles.geoDotOk : item.geoValidated === false ? styles.geoDotWarn : styles.geoDotUnknown,
                        ]}
                      />
                      <Text numberOfLines={1} style={[styles.clientText, { fontSize: 12 }]}>{truncateText(item.clientName, 14)}</Text>
                    </View>
                    <Text numberOfLines={1} style={[styles.cell, styles.address]}>{truncateText(item.address, 20)}</Text>
                    <Text numberOfLines={1} style={[styles.cell, styles.checkIn, { fontSize: 11 }]}>{formatTime(item.checkInTs)}</Text>
                    <Text numberOfLines={1} style={[styles.cell, styles.checkOut, { fontSize: 11 }]}>{formatTime(item.checkOutTs)}</Text>
                    <Text numberOfLines={1} style={[styles.cell, styles.duration]}>{item.durationFormatted}</Text>
                    <Text numberOfLines={1} style={[styles.cell, styles.mileage]}>{
                      item.mileageDelta !== undefined && item.mileageDelta !== null
                        ? item.mileageDelta.toFixed(1)
                        : '—'
                    }</Text>
                    <Text numberOfLines={1} style={[styles.cell, styles.contact]}>{truncateText(item.onSiteContact || '—', 12)}</Text>
                    <Text numberOfLines={1} style={[styles.cell, styles.geoValid]}>{
                      item.geoValidated === true ? 'Yes' : item.geoValidated === false ? 'No' : '—'
                    }</Text>
                  </View>
                ))}
            </View>
          </ScrollView>
        )}
      </View>
      <Modal
        visible={!!frequencyPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setFrequencyPicker(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Frequency for {frequencyPicker?.email || 'recipient'}
            </Text>
            {FREQUENCIES.map(freq => (
              <Pressable
                key={freq.value}
                style={styles.modalOption}
                onPress={() => {
                  if (frequencyPicker) {
                    updateRecipient(frequencyPicker.id, { frequency: freq.value as FrequencyValue });
                  }
                  setFrequencyPicker(null);
                }}
              >
                <Text style={styles.modalOptionText}>{freq.label}</Text>
              </Pressable>
            ))}
            <ThemedButton title="Cancel" variant="outline" onPress={() => setFrequencyPicker(null)} />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  try {
    const date = new Date(value);
    return date.toLocaleString();
  } catch {
    return value;
  }
}

function formatTime(value?: string | null) {
  if (!value) return '—';
  try {
    // Some platforms (Safari) don't parse space-separated timestamps reliably.
    // Ensure we have an ISO 'T' separator before parsing.
    let v = value;
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(v)) {
      v = v.replace(' ', 'T');
    }
    const date = new Date(v);
    // Format as HH:MM AM/PM
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return '—';
  }
}

function labelFor(value: FrequencyValue) {
  return FREQUENCIES.find(freq => freq.value === value)?.label ?? 'Weekly';
}

const styles = StyleSheet.create({
  container: { padding: spacing(4), gap: spacing(3) },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: spacing(3), borderWidth: 1, borderColor: colors.border, gap: spacing(2) },
  heading: { fontSize: 20, fontWeight: '700', color: colors.text },
  label: { fontWeight: '600', color: colors.text },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing(2), color: colors.text },
  frequencyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1) },
  frequencyBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingVertical: spacing(1), paddingHorizontal: spacing(2) },
  frequencyBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  frequencyText: { color: colors.text, fontWeight: '600' },
  frequencyTextActive: { color: '#fff' },
  rangeText: { color: colors.muted },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1.5), alignItems: 'center' },
  actionButton: { flexGrow: 1, minWidth: '45%' },
  sendBtn: { alignSelf: 'flex-start' },
  muted: { color: colors.muted },
  recipientStack: { gap: spacing(1.5) },
  recipientRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1) },
  recipientInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1.5),
    color: colors.text,
  },
  frequencyPicker: {
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  frequencyPickerText: { color: colors.primary, fontWeight: '600' },
  removeRecipient: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fee2e2',
  },
  removeRecipientText: { color: '#b91c1c', fontWeight: '800', fontSize: 18, lineHeight: 18 },
  tableRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  tableHeaderRow: { backgroundColor: '#f4f4f5' },
  cell: { width: 100, paddingVertical: spacing(1), paddingHorizontal: spacing(0.5), color: colors.text, fontSize: 12 },
  technician: { width: 100 },
  route: { width: 55 },
  client: { width: 110 },
  address: { width: 135 },
  checkIn: { width: 110 },
  checkOut: { width: 80 },
  duration: { width: 80 },
  mileage: { width: 70 },
  contact: { width: 85 },
  geoValid: { width: 75 },
  clientCell: { flexDirection: 'row', alignItems: 'center', width: 110 },
  clientText: { color: colors.text, flex: 1 },
  geoDot: { width: 12, height: 12, borderRadius: 6, marginRight: spacing(0.5), flexShrink: 0 },
  geoDotOk: { backgroundColor: '#22c55e' },
  geoDotWarn: { backgroundColor: '#ef4444' },
  geoDotUnknown: { backgroundColor: '#d4d4d8' },
  headerCell: { fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', padding: spacing(4) },
  modalCard: { width: '100%', maxWidth: 360, backgroundColor: colors.card, borderRadius: 12, padding: spacing(4), gap: spacing(1.5), borderWidth: 1, borderColor: colors.border },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  modalOption: { paddingVertical: spacing(1), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  modalOptionText: { fontSize: 16, color: colors.text, fontWeight: '600' },
});
