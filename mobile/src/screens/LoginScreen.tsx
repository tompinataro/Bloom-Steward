import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigationTypes';
import { useAuth } from '../auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoadingOverlay from '../components/LoadingOverlay';
import ThemedButton from '../components/Button';
import { colors, spacing } from '../theme';
import { showBanner } from '../components/globalBannerBus';

type Props = NativeStackScreenProps<RootStackParamList, 'LoginForm'>;

export default function LoginFormScreen(_props: Props) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('marc@bloomsteward.com');
  const [password, setPassword] = useState('Tom');
  const [initialOdometer, setInitialOdometer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      await signIn(email, password, initialOdometer.trim() || undefined);
      if (initialOdometer.trim()) {
        await AsyncStorage.setItem('dailyInitialOdometer', initialOdometer.trim());
      }
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setError(msg);
      showBanner({ type: 'error', message: `Login failed - ${msg}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" scrollEnabled={true} bounces={false}>
        <View style={styles.inputsSection}>
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
            returnKeyType="next"
            textContentType="oneTimeCode"
            autoComplete="off"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={initialOdometer}
            onChangeText={setInitialOdometer}
            placeholder="Starting Odometer (optional)"
            placeholderTextColor={colors.muted}
            returnKeyType="go"
            onSubmitEditing={onSubmit}
            autoComplete="off"
            autoCorrect={false}
          />
          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
          {loading ? (
            <ActivityIndicator />
          ) : (
            <ThemedButton title="Log In" onPress={onSubmit} style={styles.fullWidthBtn} />
          )}
        </View>
        <View style={styles.logoFrame}>
          <Image source={require('../../assets/brand-logo.png')} style={styles.logo} resizeMode="contain" />
        </View>
      </ScrollView>
      <LoadingOverlay visible={loading} />
    </KeyboardAvoidingView>
  );
}

import { Image } from 'react-native';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, width: '100%', maxWidth: 420, alignItems: 'center', gap: spacing(2), padding: spacing(6), justifyContent: 'space-between', alignSelf: 'center' },
  inputsSection: { width: '100%', gap: spacing(3) },
  logoFrame: {
    width: '100%',
    aspectRatio: 1,
    borderWidth: 3,
    borderColor: '#000',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    overflow: 'hidden',
    marginTop: spacing(4),
  },
  logo: { width: '92%', height: '92%' },
  input: { width: '100%', borderColor: colors.border, color: colors.text, borderWidth: 1, padding: spacing(3), borderRadius: 8, backgroundColor: colors.card },
  fullWidthBtn: { alignSelf: 'stretch', marginTop: spacing(2) },
  error: { color: colors.danger, marginTop: spacing(2) },
});

