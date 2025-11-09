import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigationTypes';
import { useAuth } from '../auth';
import ThemedButton from '../components/Button';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Account'>;

export default function AccountScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();
  const displayName = user?.name === 'Marc' ? 'Marc Peterson' : user?.name;

  const buttons = [
    { title: 'Field Technicians', route: 'FieldTechnicians' as const },
    { title: 'Client Locations', route: 'ClientLocations' as const },
    { title: 'Service Routes', route: 'ServiceRoutes' as const },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.name}>{displayName}</Text>
          <PressableText label="Sign Out" onPress={signOut} />
        </View>
        <Text style={styles.email}>{user?.email}</Text>
      </View>
      <View style={styles.buttonStack}>
        {buttons.map(btn => (
          <ThemedButton
            key={btn.title}
            title={btn.title}
            onPress={() => navigation.navigate(btn.route)}
            style={styles.stackButton}
          />
        ))}
      </View>
    </View>
  );
}

function PressableText({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.inlineChip} onPress={onPress}>
      <Text style={styles.inlineChipText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing(4),
    gap: spacing(4),
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing(3),
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing(1),
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 22, fontWeight: '700', color: colors.text },
  email: { color: colors.muted, fontSize: 15 },
  inlineChip: { paddingHorizontal: spacing(2), paddingVertical: spacing(1), borderRadius: 999, backgroundColor: '#ede9fe' },
  inlineChipText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  buttonStack: { gap: spacing(2) },
  stackButton: { width: '100%' },
});
