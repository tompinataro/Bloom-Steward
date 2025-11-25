import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, Image } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigationTypes';
import { useAuth } from '../auth';
// API helpers not shown on login screen
import LoadingOverlay from '../components/LoadingOverlay';
import ThemedButton from '../components/Button';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen(_props: Props) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('marc@bloomsteward.com');
  const [password, setPassword] = useState('Tom');
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
      showBanner({ type: 'error', message: `Login failed - ${msg}` });
    } finally {
      setLoading(false);
    }
  };

  // onPing removed

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoFrame}>
          <Image source={require('../../assets/brand-logo.png')} style={styles.logo} resizeMode="contain" />
        </View>
        {/* API URL removed */}
        <TextInput
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={colors.muted}
          returnKeyType="next"
          autoComplete="email"
          textContentType="username"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={colors.muted}
          returnKeyType="go"
          onSubmitEditing={onSubmit}
          textContentType="oneTimeCode"
          autoComplete="off"
          autoCorrect={false}
        />
        {loading ? (
          <ActivityIndicator />
        ) : (
          <ThemedButton title="Log In" onPress={onSubmit} style={styles.fullWidthBtn} />
        )}
        {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
        <LoadingOverlay visible={loading} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing(6), backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 360, alignItems: 'center', gap: spacing(2) },
  logoFrame: {
    width: '100%',
    aspectRatio: 1,
    // matches the content width (max 360)
    borderWidth: 3,
    borderColor: '#000',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    overflow: 'hidden',
    marginBottom: spacing(4),
  },
  logo: { width: '92%', height: '92%' },
  input: { width: '100%', maxWidth: 360, borderColor: colors.border, color: colors.text, borderWidth: 1, padding: spacing(3), borderRadius: 8, marginBottom: spacing(3), backgroundColor: colors.card },
  fullWidthBtn: { alignSelf: 'stretch' }
  ,error: { color: colors.danger, marginTop: spacing(2) }
});
import { showBanner } from '../components/globalBannerBus';
