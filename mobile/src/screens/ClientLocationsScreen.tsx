import React, { useState } from 'react';
import { ScrollView, View, Text, TextInput, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigationTypes';
import { useAuth } from '../auth';
import { showBanner } from '../components/globalBannerBus';
import { adminCreateClient } from '../api/client';
import ThemedButton from '../components/Button';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ClientLocations'>;

const NAME_MAX = 40;
const ADDRESS_MAX = 80;

export default function ClientLocationsScreen(_props: Props) {
  const { token } = useAuth();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [creating, setCreating] = useState(false);

  const addClient = async () => {
    if (!token) return;
    const trimmedName = name.trim().slice(0, NAME_MAX);
    const trimmedAddress = address.trim().slice(0, ADDRESS_MAX);
    if (!trimmedName || !trimmedAddress) {
      showBanner({ type: 'error', message: 'Name and address are required.' });
      return;
    }
    setCreating(true);
    try {
      await adminCreateClient(token, {
        name: trimmedName,
        address: trimmedAddress,
        contactName: contactName.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
      });
      showBanner({ type: 'success', message: `Added ${trimmedName}.` });
      setName('');
      setAddress('');
      setContactName('');
      setContactPhone('');
    } catch (err: any) {
      showBanner({ type: 'error', message: err?.message || 'Unable to add client.' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Create Client Location</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Client name"
          placeholderTextColor={colors.muted}
          maxLength={NAME_MAX}
        />
        <TextInput
          style={styles.input}
          value={address}
          onChangeText={setAddress}
          placeholder="Service address"
          placeholderTextColor={colors.muted}
          maxLength={ADDRESS_MAX}
        />
        <TextInput
          style={styles.input}
          value={contactName}
          onChangeText={setContactName}
          placeholder="Primary contact (optional)"
          placeholderTextColor={colors.muted}
        />
        <TextInput
          style={styles.input}
          value={contactPhone}
          onChangeText={setContactPhone}
          placeholder="Contact phone (optional)"
          placeholderTextColor={colors.muted}
          keyboardType="phone-pad"
        />
        <ThemedButton title={creating ? 'Adding...' : 'Add Client Location'} onPress={addClient} disabled={creating} />
      </View>
    </ScrollView>
  );
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
});
