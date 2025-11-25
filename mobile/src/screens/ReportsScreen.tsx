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
  const { token } = useAuth();
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
      showBanner({ type: 'success', message: 'Report email(s) queued.' });
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
                {summaryHeaders.map(header => (
                  <Text key={header} style={[styles.cell, styles.headerCell]}>{header}</Text>
                ))}
              </View>
                {summary.map((item, index) => (
                  <View key={`${item.techId}-${item.clientName}-${index}`} style={styles.tableRow}>
                    <Text style={styles.cell}>{item.techName}</Text>
                    <Text style={styles.cell}>{item.routeName || '—'}</Text>
                    <View style={[styles.cell, styles.clientCell]}>
                      <View
                        style={[
                          styles.geoDot,
                          item.geoValidated === true ? styles.geoDotOk : item.geoValidated === false ? styles.geoDotWarn : styles.geoDotUnknown,
                        ]}
                      />
                      <Text style={styles.clientText}>{truncateText(item.clientName, 22)}</Text>
                    </View>
                    <Text style={styles.cell}>{truncateText(item.address, 28)}</Text>
                    <Text style={styles.cell}>{formatDate(item.checkInTs)}</Text>
                    <Text style={styles.cell}>{formatDate(item.checkOutTs)}</Text>
                  <Text style={styles.cell}>{item.durationFormatted}</Text>
                  <Text style={styles.cell}>{item.mileageDelta.toFixed(2)}</Text>
                  <Text style={styles.cell}>{item.onSiteContact || '—'}</Text>
                  <Text style={styles.cell}>
                    {item.distanceFromClientFeet !== undefined && item.distanceFromClientFeet !== null
                      ? item.distanceFromClientFeet.toFixed(0)
                      : '—'}
                  </Text>
                  <Text style={styles.cell}>{item.geoValidated ? 'Matched' : 'Needs check'}</Text>
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
  cell: { minWidth: 120, paddingVertical: spacing(1), paddingHorizontal: spacing(1), color: colors.text },
  clientCell: { flexDirection: 'row', alignItems: 'center', minWidth: 140 },
  clientText: { color: colors.text },
  geoDot: { width: 12, height: 12, borderRadius: 6, marginRight: spacing(1) },
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
