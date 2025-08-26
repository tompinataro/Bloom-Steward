import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Button, ActivityIndicator } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type RootStackParamList = { Home: undefined; About: undefined; };
type Props = NativeStackScreenProps<RootStackParamList, 'About'>;

export default function AboutScreen({ navigation }: Props) {
  const [result, setResult] = useState<string>('loading...');
  const api = process.env.EXPO_PUBLIC_API_URL || 'https://example.com';

  useEffect(() => {
    const url = `${api.replace(/\/$/, '')}/health`;
    fetch(url)
      .then(r => r.json())
      .then(j => setResult(`ok=${String(j.ok)}  ts=${j.ts || 'n/a'}`))
      .catch(err => setResult(`error: ${err?.message || 'unknown'}`));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>About Bloom Steward</Text>
      <Text style={styles.sub}>API: {api}</Text>
      <Text style={styles.statusLabel}>/health status:</Text>
      {result === 'loading...' ? <ActivityIndicator /> : <Text style={styles.status}>{result}</Text>}
      <Button title="Back to Home" onPress={() => navigation.navigate('Home')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#fff', gap: 8 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  sub: { fontSize: 12, color: '#666' },
  statusLabel: { marginTop: 8, fontWeight: '600' },
  status: { fontFamily: 'Courier', marginTop: 4 }
});
