import React, { useState } from 'react';
import { ScrollView, View, Text, TextInput, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigationTypes';
import { useAuth } from '../auth';
import { showBanner } from '../components/globalBannerBus';
import { adminCreateUser } from '../api/client';
import ThemedButton from '../components/Button';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'FieldTechnicians'>;

export default function FieldTechniciansScreen(_props: Props) {
  const { token } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [lastTemp, setLastTemp] = useState<{ name: string; password: string } | null>(null);

  const createTech = async () => {
    if (!token) return;
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedName || !trimmedEmail) {
      showBanner({ type: 'error', message: 'Name and email are required.' });
      return;
    }
    setCreating(true);
    try {
      const res = await adminCreateUser(token, { name: trimmedName, email: trimmedEmail, role: 'tech' });
      if (res?.ok) {
        setLastTemp({ name: res.user.name, password: res.tempPassword });
        setName('');
        setEmail('');
        showBanner({ type: 'success', message: `Added ${res.user.name}. Share their temp password.` });
      }
    } catch (err: any) {
      showBanner({ type: 'error', message: err?.message || 'Unable to add field tech.' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Create Field Tech</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Full name"
          placeholderTextColor={colors.muted}
          autoCapitalize="words"
          returnKeyType="next"
        />
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          keyboardType="email-address"
          returnKeyType="done"
        />
        <ThemedButton title={creating ? 'Adding...' : 'Add Field Tech'} onPress={createTech} disabled={creating} />
        {lastTemp ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              {formatPossessive(lastTemp.name)} temp pw = {lastTemp.password}
            </Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function formatPossessive(name?: string | null) {
  if (!name) return '';
  const trimmed = name.trim();
  if (!trimmed) return '';
  return /s$/i.test(trimmed) ? `${trimmed}'` : `${trimmed}'s`;
}

const styles = StyleSheet.create({
  container: { padding: spacing(4) },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: spacing(3), borderWidth: 1, borderColor: colors.border, gap: spacing(2) },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    color: colors.text,
    backgroundColor: colors.card,
  },
  notice: { marginTop: spacing(2), padding: spacing(2), backgroundColor: '#ecfdf5', borderRadius: 10, borderWidth: 1, borderColor: '#6ee7b7' },
  noticeText: { color: '#047857', fontWeight: '600' },
});
