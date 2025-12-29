import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigationTypes';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ClientAssignments'>;

export default function ClientAssignmentsScreen({ route }: Props) {
  const clients = route.params?.clients ?? [];
  return (
    <ScrollView contentContainerStyle={styles.container}>
      {clients.length === 0 ? (
        <Text style={styles.emptyCopy}>No clients yet. Add one first.</Text>
      ) : (
        clients.map((client) => (
          <View key={client.id} style={styles.card}>
            <Text style={styles.clientName}>{client.name}</Text>
            <Text style={styles.clientMeta}>{client.address}</Text>
            <Text style={styles.clientMetaSmall}>Assigned to: {client.assigned_user_name || 'Unassigned'}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing(4),
    gap: spacing(3),
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing(3),
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing(1),
  },
  clientName: { fontSize: 17, fontWeight: '700', color: colors.text },
  clientMeta: { color: colors.text, fontSize: 14 },
  clientMetaSmall: { color: colors.muted, fontSize: 13 },
  emptyCopy: { color: colors.muted, fontSize: 15, textAlign: 'center' },
});
