import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigationTypes';
import { useAuth } from '../auth';
import ThemedButton from '../components/Button';
import Card from '../components/Card';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Account'>;

export default function AccountScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();
  const displayName = user?.name === 'Marc' ? 'Marc Peterson' : user?.name;

  const sections = [
    { title: 'Client Locations', viewRoute: 'ClientLocations' as const, addRoute: 'ClientLocations' as const },
    { title: 'Service Routes', viewRoute: 'AllServiceRoutes' as const, addRoute: 'ServiceRoutes' as const },
    { title: 'Field Technicians', viewRoute: 'AllFieldTechnicians' as const, addRoute: 'FieldTechnicians' as const },
    { title: 'Report Generator', viewRoute: 'Reports' as const, addRoute: 'Reports' as const },
  ];

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.name}>{displayName}</Text>
          <PressableText label="Sign Out" onPress={signOut} />
        </View>
        <Text style={styles.email}>{user?.email}</Text>
      </Card>
      <View style={styles.sectionStack}>
        {sections.map(section => (
          <Card key={section.title} style={styles.sectionCard}>
            <Text style={styles.sectionHeading}>{section.title}</Text>
            <View style={styles.sectionButtons}>
              <ThemedButton
                title={section.viewRoute === 'Reports' ? 'Field Work Summary Report' : 'View All'}
                onPress={() => {
                  if (section.viewRoute === 'ClientLocations') {
                    navigation.navigate(section.viewRoute, { mode: 'all' });
                  } else {
                    navigation.navigate(section.viewRoute);
                  }
                }}
                style={[
                  styles.sectionButton,
                  section.viewRoute === 'Reports' ? styles.reportButton : null,
                ]}
              />
              {section.addRoute !== 'Reports' && (
                <ThemedButton
                  title="Add New"
                  onPress={() => navigation.navigate(section.addRoute)}
                  variant="outline"
                  style={styles.sectionButton}
                />
              )}
            </View>
          </Card>
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
  card: { gap: spacing(1) },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 22, fontWeight: '700', color: colors.text },
  email: { color: colors.muted, fontSize: 15 },
  inlineChip: { paddingHorizontal: spacing(2), paddingVertical: spacing(1), borderRadius: 999, backgroundColor: colors.primary },
  inlineChipText: { color: colors.card, fontWeight: '600', fontSize: 13 },
  sectionStack: { gap: spacing(3) },
  sectionCard: { paddingVertical: spacing(3), paddingHorizontal: spacing(3), gap: spacing(1.5) },
  sectionHeading: { fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center' },
  sectionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing(2),
    rowGap: spacing(1.25),
    justifyContent: 'center',
  },
  sectionButton: { width: '40%', minWidth: 120, paddingVertical: spacing(1.25) },
  reportButton: { width: '70%', alignSelf: 'center' },
});
