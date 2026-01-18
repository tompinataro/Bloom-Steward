import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Pressable, Linking, Share } from 'react-native';
import * as MailComposer from 'expo-mail-composer';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigationTypes';
import { useAuth } from '../auth';
import ThemedButton from '../components/Button';
import Card from '../components/Card';
import { colors, spacing } from '../theme';
import { showBanner } from '../components/globalBannerBus';
import { adminFetchReportSummary, adminSendReport, ReportSummaryRow } from '../api/client';
import { flushQueue, getQueueStats } from '../offlineQueue';
import { truncateText } from '../utils/text';

const FREQUENCIES = [
  { label: 'Day', value: 'daily' },
  { label: 'Week', value: 'weekly' },
  { label: 'Pay Period', value: 'payperiod' },
  { label: 'Month', value: 'monthly' },
  { label: 'Custom', value: 'custom' },
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

function formatShortDateInput(value: string) {
  const digits = value.replace(/[^\d]/g, '').slice(0, 8);
  if (!digits) return '';
  const mm = digits.slice(0, 2);
  const dd = digits.slice(2, 4);
  const rest = digits.slice(4);
  let out = mm;
  if (digits.length >= 3) out = `${mm}/${dd}`;
  if (rest) out = `${mm}/${dd}/${rest}`;
  return out;
}

function parseShortDate(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const yearRaw = match[3];
  const year = yearRaw.length === 2 ? Number(`20${yearRaw}`) : Number(yearRaw);
  if (!month || !day || !year) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function todayShortDate() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}/${dd}/${yy}`;
}

export default function ReportsScreen(_props: Props) {
  const { token, user } = useAuth();
  const [recipients, setRecipients] = useState<RecipientTarget[]>([newRecipient()]);
  const [previewFrequency, setPreviewFrequency] = useState<FrequencyValue>('weekly');
  const [summary, setSummary] = useState<ReportSummaryRow[]>([]);
  const [rangeText, setRangeText] = useState('—');
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [sending, setSending] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const isCustom = previewFrequency === 'custom';

  const fetchSummary = async () => {
    if (!token) return;
    setLoadingSummary(true);
    try {
      try {
        const { sent, remaining } = await flushQueue(token);
        if (sent > 0) {
          showBanner({ type: 'info', message: `Synced ${sent} offline visit${sent > 1 ? 's' : ''} before refresh.` });
        } else if (remaining > 0) {
          const stats = await getQueueStats();
          if (stats.maxAttempts >= 3) {
            showBanner({ type: 'info', message: `Retrying ${remaining} queued visit${remaining > 1 ? 's' : ''} in background.` });
          }
        }
      } catch {}
      const customStartIso = parseShortDate(customStartDate);
      const customEndIso = parseShortDate(customEndDate);
      if (isCustom && (!customStartIso || !customEndIso)) {
        showBanner({ type: 'error', message: 'Enter start/end as MM/DD/YY for custom range.' });
        return;
      }
      const customStart = customStartIso ? `${customStartIso}T00:00:00` : undefined;
      const customEnd = customEndIso ? `${customEndIso}T23:59:59` : undefined;
      const res = await adminFetchReportSummary(token, {
        frequency: previewFrequency,
        startDate: customStart,
        endDate: customEnd,
      });
      setSummary(res.rows || []);
      setRangeText(buildRangeLabel(res.range, previewFrequency, customStartIso, customEndIso));
    } catch (err: any) {
      showBanner({ type: 'error', message: err?.message || 'Unable to fetch report.' });
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    if (!isCustom) {
      fetchSummary();
      return;
    }
    const startOk = !!parseShortDate(customStartDate);
    const endOk = !!parseShortDate(customEndDate);
    if (startOk && endOk) {
      fetchSummary();
    }
  }, [token, previewFrequency, customStartDate, customEndDate]);

  useEffect(() => {
    if (!isCustom) return;
    if (!customStartDate && !customEndDate) {
      const today = todayShortDate();
      setCustomStartDate(today);
      setCustomEndDate(today);
    }
  }, [isCustom, customStartDate, customEndDate]);

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
    if (isCustom) {
      const startIso = parseShortDate(customStartDate);
      const endIso = parseShortDate(customEndDate);
      if (!startIso || !endIso) {
        showBanner({ type: 'error', message: 'Enter start/end as MM/DD/YY for custom range.' });
        return;
      }
      setSending(true);
      try {
        const res = await adminFetchReportSummary(token, {
          frequency: 'custom',
          startDate: `${startIso}T00:00:00`,
          endDate: `${endIso}T23:59:59`,
        });
        const rows = res.rows || [];
        const rangeLabel = buildRangeLabel(res.range, 'custom', startIso, endIso);
        const summaryLines = rows.length
          ? rows.map(item => {
              if (item.rowType === 'spacer') return '';
              if (item.rowType === 'total') {
                const miles = Number.isFinite(item.mileageDelta) ? item.mileageDelta.toFixed(1) : '—';
                return `${item.techName} | Mileage Total: ${miles}`;
              }
              return `${item.techName} | ${item.routeName || '—'} | Date: ${formatCompactDate(item.visitDate)} | ${item.clientName} | Notes: ${item.techNotes || '—'} | ${item.address} | In: ${formatTime(item.checkInTs)} Out: ${formatTime(item.checkOutTs)} | Duration: ${item.durationFormatted || '—'} | Miles: ${Number.isFinite(item.mileageDelta) ? item.mileageDelta.toFixed(1) : '—'} | Contact: ${item.onSiteContact || '—'} | Geo: ${item.geoValidated === true ? 'Yes' : item.geoValidated === false ? 'No' : '—'}`;
            })
          : ['(No visits recorded for this range)'];
        const subject = 'Field Tech Summary (Custom)';
        const body = `Range: ${rangeLabel}\nFrequency: custom\n\n${summaryLines.join('\n')}\n\nGenerated from Bloom Steward.`;
        if (await MailComposer.isAvailableAsync()) {
          await MailComposer.composeAsync({ subject, body, recipients: cleaned.map(r => r.email) });
        } else {
          const mailto = `mailto:${encodeURIComponent(cleaned.map(r => r.email).join(','))}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
          const canMail = await Linking.canOpenURL(mailto);
          if (canMail) {
            await Linking.openURL(mailto);
          } else {
            await Share.share({ title: subject, message: body });
          }
        }
        showBanner({ type: 'success', message: 'Report email started (sent via Mail/share).' });
      } catch (err: any) {
        showBanner({ type: 'error', message: err?.message || 'Unable to send report.' });
      } finally {
        setSending(false);
      }
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
        const subject = `Field Tech Summary (${freq})`;
        const res = await adminFetchReportSummary(token, { frequency: freq });
        const rows = res.rows || [];
        const rangeLabel = buildRangeLabel(res.range, freq as FrequencyValue);
        const summaryLines = rows.length
          ? rows.map(item => {
              if (item.rowType === 'spacer') return '';
              if (item.rowType === 'total') {
                const miles = Number.isFinite(item.mileageDelta) ? item.mileageDelta.toFixed(1) : '—';
                return `${item.techName} | Mileage Total: ${miles}`;
              }
              return `${item.techName} | ${item.routeName || '—'} | Date: ${formatCompactDate(item.visitDate)} | ${item.clientName} | Notes: ${item.techNotes || '—'} | ${item.address} | In: ${formatTime(item.checkInTs)} Out: ${formatTime(item.checkOutTs)} | Duration: ${item.durationFormatted || '—'} | Miles: ${Number.isFinite(item.mileageDelta) ? item.mileageDelta.toFixed(1) : '—'} | Contact: ${item.onSiteContact || '—'} | Geo: ${item.geoValidated === true ? 'Yes' : item.geoValidated === false ? 'No' : '—'}`;
            })
          : ['(No visits recorded for this range)'];
        const body = `Range: ${rangeLabel}\nFrequency: ${freq}\n\n${summaryLines.join('\n')}\n\nGenerated from Bloom Steward.`;
        const mailto = `mailto:${encodeURIComponent(emails.join(','))}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        // Prefer client-side compose to avoid SMTP 554 errors; never block on server send
        if (await MailComposer.isAvailableAsync()) {
          await MailComposer.composeAsync({ subject, body, recipients: emails });
          continue;
        }
        const canMail = await Linking.canOpenURL(mailto);
        if (canMail) {
          await Linking.openURL(mailto);
          continue;
        }
        await Share.share({ title: subject, message: body });
      }
      showBanner({ type: 'success', message: 'Report email started (sent via Mail/share).' });
    } catch (err: any) {
      // Fallback: try opening mail client with the summary text
      try {
        const summaryLines = summary.length
          ? summary.map(item => {
              if (item.rowType === 'spacer') return '';
              if (item.rowType === 'total') {
                const miles = Number.isFinite(item.mileageDelta) ? item.mileageDelta.toFixed(1) : '—';
                return `${item.techName} | Mileage Total: ${miles}`;
              }
              return `${item.techName} | ${item.routeName || '—'} | Date: ${formatCompactDate(item.visitDate)} | ${item.clientName} | Notes: ${item.techNotes || '—'} | ${item.address} | In: ${formatTime(item.checkInTs)} Out: ${formatTime(item.checkOutTs)} | Duration: ${item.durationFormatted || '—'} | Miles: ${Number.isFinite(item.mileageDelta) ? item.mileageDelta.toFixed(1) : '—'} | Contact: ${item.onSiteContact || '—'} | Geo: ${item.geoValidated === true ? 'Yes' : item.geoValidated === false ? 'No' : '—'}`;
            })
          : ['(No visits recorded for this range)'];
        const subject = 'Field Summary Report';
        const body = `Range: ${rangeText}\nFrequency: ${previewFrequency}\n\n${summaryLines.join('\n')}`;
        const mailto = `mailto:${encodeURIComponent(cleaned.map(r => r.email).join(','))}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        if (await MailComposer.isAvailableAsync()) {
          await MailComposer.composeAsync({ subject, body, recipients: cleaned.map(r => r.email) });
          showBanner({ type: 'info', message: 'Opened mail composer since server email failed.' });
        } else if (await Linking.canOpenURL(mailto)) {
          await Linking.openURL(mailto);
          showBanner({ type: 'info', message: 'Opened mail client since server email failed.' });
        } else {
          showBanner({ type: 'error', message: err?.message || 'Unable to send report.' });
        }
      } catch {
        showBanner({ type: 'error', message: err?.message || 'Unable to send report.' });
      }
    } finally {
      setSending(false);
    }
  };

  const summaryHeaders = useMemo(() => [
    'Technician',
    'Route',
    'Date',
    'Client',
    'Notes',
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
      <Card>
        <Text style={styles.heading}>Summary Report Generator</Text>
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
              <Pressable style={styles.removeRecipient} onPress={() => removeRecipient(rec.id)}>
                <Text style={styles.removeRecipientText}>×</Text>
              </Pressable>
            </View>
          ))}
        </View>
        <ThemedButton title="Add Recipient" variant="outline" onPress={addRecipient} />

        <Text style={styles.label}>Report Date Range</Text>
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
        {isCustom ? (
          <View style={styles.customRangeRow}>
            <TextInput
              style={styles.customInput}
              value={customStartDate}
              onChangeText={(text) => setCustomStartDate(formatShortDateInput(text))}
              placeholder="MM/DD/YY"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.customInput}
              value={customEndDate}
              onChangeText={(text) => setCustomEndDate(formatShortDateInput(text))}
              placeholder="MM/DD/YY"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
            />
          </View>
        ) : null}
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
      </Card>
      <Card>
        <Text style={styles.heading}>Summary Report Preview</Text>
        {summary.length === 0 ? (
          <Text style={styles.muted}>{loadingSummary ? 'Loading…' : 'No visits recorded for this range.'}</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View>
              <View style={[styles.tableRow, styles.tableHeaderRow]}>
                <Text numberOfLines={1} style={[styles.cell, styles.technician, styles.headerCell]}>Technician</Text>
                <Text numberOfLines={1} style={[styles.cell, styles.route, styles.headerCell]}>Route</Text>
                <Text numberOfLines={1} style={[styles.cell, styles.date, styles.headerCell]}>Date</Text>
                <Text numberOfLines={1} style={[styles.cell, styles.client, styles.headerCell]}>Client</Text>
                <Text numberOfLines={1} style={[styles.cell, styles.notes, styles.headerCell]}>Notes</Text>
                <Text numberOfLines={1} style={[styles.cell, styles.address, styles.headerCell]}>Address</Text>
                <Text numberOfLines={1} style={[styles.cell, styles.checkIn, styles.headerCell]}>Check-In</Text>
                <Text numberOfLines={1} style={[styles.cell, styles.checkOut, styles.headerCell]}>Check-Out</Text>
                <Text numberOfLines={1} style={[styles.cell, styles.duration, styles.headerCell]}>Duration</Text>
                <Text numberOfLines={1} style={[styles.cell, styles.mileage, styles.headerCell]}>Mileage</Text>
                <Text numberOfLines={1} style={[styles.cell, styles.contact, styles.headerCell]}>Contact</Text>
                <Text numberOfLines={1} style={[styles.cell, styles.geoValid, styles.headerCell]}>Geo Valid</Text>
              </View>
                {summary.map((item, index) => {
                  if (item.rowType === 'spacer') {
                    return <View key={`spacer-${index}`} style={styles.spacerRow} />;
                  }
                  const isTotal = item.rowType === 'total';
                  const geoFail = !isTotal && (item.geoValidated === false || (item.distanceFromClientFeet !== null && item.distanceFromClientFeet !== undefined && item.distanceFromClientFeet > 300));
                  const durationFail = !isTotal && (geoFail || !!item.durationFlag);
                  const clientFail = !isTotal && (geoFail || durationFail || !!item.geoFlag);
                  const clientTextStyle = isTotal
                    ? [styles.clientText, styles.totalText]
                    : (clientFail ? [styles.clientText, styles.flaggedText] : styles.clientText);
                  const durationTextStyle = isTotal
                    ? [styles.cell, styles.duration, styles.totalText]
                    : (durationFail ? [styles.cell, styles.duration, styles.flaggedText] : [styles.cell, styles.duration]);
                  const geoTextStyle = isTotal
                    ? [styles.cell, styles.geoValid, styles.totalText]
                    : (geoFail ? [styles.cell, styles.geoValid, styles.flaggedText] : [styles.cell, styles.geoValid]);
                  return (
                    <View key={`${item.techId}-${item.clientName}-${index}`} style={styles.tableRow}>
                    <Text numberOfLines={1} style={[styles.cell, styles.technician, isTotal ? styles.totalText : null]}>{truncateText(item.techName, 14)}</Text>
                    <Text numberOfLines={1} style={[styles.cell, styles.route, isTotal ? styles.totalText : null]}>{item.routeName || ''}</Text>
                    <Text numberOfLines={1} style={[styles.cell, styles.date, isTotal ? styles.totalText : null]}>{isTotal ? '' : formatCompactDate(item.visitDate)}</Text>
                    <View style={[styles.clientCell]}>
                      {/* GEO VALIDATION DOT DISABLED (Dec 2025)
                          Commented out the colored circle indicator showing geo validation status
                          (green=valid, red=invalid, grey=missing). Can be re-enabled by uncommenting
                          the View below and adjusting clientCell width if needed.
                      */}
                      {/* <View
                        style={[
                          styles.geoDot,
                          item.geoValidated === true ? styles.geoDotOk : item.geoValidated === false ? styles.geoDotWarn : styles.geoDotUnknown,
                        ]}
                      /> */}
                      <Text numberOfLines={1} style={[clientTextStyle, { fontSize: 12 }]}>{truncateText(item.clientName, 18)}</Text>
                    </View>
                    <Text numberOfLines={1} style={[styles.cell, styles.notes, isTotal ? styles.totalText : null]}>{isTotal ? '' : truncateText(item.techNotes || '—', 16)}</Text>
                    <Text numberOfLines={1} style={[styles.cell, styles.address, isTotal ? styles.totalText : null]}>{isTotal ? '' : truncateText(item.address, 20)}</Text>
                    <Text numberOfLines={1} style={[styles.cell, styles.checkIn, { fontSize: 11 }]}>{isTotal ? '' : formatTime(item.checkInTs)}</Text>
                    <Text numberOfLines={1} style={[styles.cell, styles.checkOut, { fontSize: 11 }]}>{isTotal ? '' : formatTime(item.checkOutTs)}</Text>
                    <Text numberOfLines={1} style={durationTextStyle}>{isTotal ? '' : item.durationFormatted}</Text>
                    <Text numberOfLines={1} style={[styles.cell, styles.mileage, isTotal ? styles.totalText : null]}>{
                      item.mileageDelta !== undefined && item.mileageDelta !== null
                        ? item.mileageDelta.toFixed(1)
                        : '—'
                    }</Text>
                    <Text numberOfLines={1} style={[styles.cell, styles.contact, isTotal ? styles.totalText : null]}>{isTotal ? '' : truncateText(item.onSiteContact || '—', 12)}</Text>
                    <Text numberOfLines={1} style={geoTextStyle}>{
                      isTotal ? '' : (item.geoValidated === true ? 'Yes' : item.geoValidated === false ? 'No' : '—')
                    }</Text>
                  </View>
                  );
                })}
            </View>
          </ScrollView>
        )}
      </Card>
    </ScrollView>
  );
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  let raw = value;
  if (raw.includes('T')) raw = raw.split('T')[0];
  if (raw.includes(' ')) raw = raw.split(' ')[0];
  const parts = raw.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    const [year, month, day] = parts;
    return `${Number(month)}/${Number(day)}/${year}`;
  }
  try {
    const date = new Date(value);
    return date.toLocaleDateString();
  } catch {
    return value;
  }
}

function buildRangeLabel(
  range: { start?: string | null; end?: string | null } | undefined,
  frequency: FrequencyValue,
  customStartIso?: string | null,
  customEndIso?: string | null
) {
  if (frequency === 'custom' && customStartIso && customEndIso) {
    return `${formatDate(customStartIso)} – ${formatDate(customEndIso)}`;
  }
  if (frequency === 'daily' && range?.start) {
    return `${formatDate(range.start)} – ${formatDate(range.start)}`;
  }
  return `${formatDate(range?.start)} – ${formatDate(range?.end)}`;
}

function formatCompactDate(value?: string | null) {
  if (!value) return '—';
  let raw = value;
  if (raw.includes('T')) raw = raw.split('T')[0];
  if (raw.includes(' ')) raw = raw.split(' ')[0];
  const parts = raw.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    const [year, month, day] = parts;
    return `${month.padStart(2, '0')}${day.padStart(2, '0')}${year.slice(-2)}`;
  }
  try {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const yy = String(d.getFullYear()).slice(-2);
      return `${mm}${dd}${yy}`;
    }
  } catch {}
  return value;
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

const styles = StyleSheet.create({
  container: { padding: spacing(4), gap: spacing(3) },
  heading: { fontSize: 20, fontWeight: '700', color: colors.text },
  label: { fontWeight: '600', color: colors.text },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing(2), color: colors.text },
  frequencyRow: { flexDirection: 'row', flexWrap: 'nowrap', gap: spacing(0.5), justifyContent: 'space-between' },
  frequencyBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingVertical: spacing(0.5), paddingHorizontal: spacing(1.25), flexShrink: 1 },
  frequencyBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  frequencyText: { color: colors.text, fontWeight: '600', fontSize: 12 },
  frequencyTextActive: { color: '#fff' },
  customRangeRow: { flexDirection: 'row', gap: spacing(1), alignItems: 'center', flexWrap: 'wrap' },
  customInput: { flex: 1, minWidth: 140, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: spacing(2), paddingVertical: spacing(1.5), color: colors.text },
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
  route: { width: 70, paddingRight: spacing(2) },
  client: { width: 110 },
  notes: { width: 140 },
  address: { width: 155 },
  date: { width: 70 },
  checkIn: { width: 100 },
  checkOut: { width: 100 },
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
  flaggedText: { color: '#b91c1c', fontWeight: '700' },
  totalText: { fontWeight: '700' },
  headerCell: { fontWeight: '700' },
  spacerRow: { height: spacing(2) },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', padding: spacing(4) },
  modalCard: { width: '100%', maxWidth: 360, backgroundColor: colors.card, borderRadius: 12, padding: spacing(4), gap: spacing(1.5), borderWidth: 1, borderColor: colors.border },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  modalOption: { paddingVertical: spacing(1), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  modalOptionText: { fontSize: 16, color: colors.text, fontWeight: '600' },
});
