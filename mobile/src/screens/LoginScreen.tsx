import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { useAuth } from '../auth';
import { API_BASE, health } from '../api/client';
import LoadingOverlay from '../components/LoadingOverlay';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen(_props: Props) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('demo@example.com');
  const [password, setPassword] = useState('password');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setError(msg);
      Alert.alert('Login failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const onPing = async () => {
    try {
      const h = await health();
      Alert.alert('API Health', `OK ${JSON.stringify(h)}\n${API_BASE}`);
    } catch (e: any) {
      Alert.alert('API Health', `${e?.message ?? String(e)}\n${API_BASE}`);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign In</Text>
      <Text style={styles.url} numberOfLines={1}>API: {API_BASE}</Text>
      <TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="Email" />
      <TextInput style={styles.input} secureTextEntry value={password} onChangeText={setPassword} placeholder="Password" />
      {loading ? <ActivityIndicator /> : <Button title="Login" onPress={onSubmit} />}
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
      <View style={{ height: 12 }} />
      <Button title="Ping API" onPress={onPing} />
      <LoadingOverlay visible={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  url: { fontSize: 12, color: '#555', marginBottom: 8 },
  input: { width: '100%', maxWidth: 360, borderColor: '#ccc', borderWidth: 1, padding: 10, borderRadius: 6, marginBottom: 12 }
  ,error: { color: '#c00', marginTop: 8 }
});
