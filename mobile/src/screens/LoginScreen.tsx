import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, Image, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as AppleAuthentication from 'expo-apple-authentication';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigationTypes';
import { useAuth } from '../auth';
// API helpers not shown on login screen
import LoadingOverlay from '../components/LoadingOverlay';
import ThemedButton from '../components/Button';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen(_props: Props) {
  const { signIn, signInWithApple } = useAuth();
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
      showBanner({ type: 'error', message: `Login failed — ${msg}` });
    } finally {
      setLoading(false);
    }
  };

  const onApple = async () => {
    setLoading(true);
    setError(null);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      await signInWithApple({
        identityToken: (credential as any)?.identityToken,
        authorizationCode: (credential as any)?.authorizationCode,
        email: credential.email ?? null,
        name: credential.fullName ? `${credential.fullName.givenName ?? ''} ${credential.fullName.familyName ?? ''}`.trim() : null,
      });
    } catch (e: any) {
      // user cancellations surface as error codes; ignore those
      if (e?.code !== 'ERR_CANCELED') {
        const msg = e?.message ?? String(e);
        setError(msg);
        showBanner({ type: 'error', message: `Apple sign-in failed — ${msg}` });
      }
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
        />
        {loading ? (
          <ActivityIndicator />
        ) : (
          <ThemedButton title="Log In" onPress={onSubmit} style={styles.fullWidthBtn} />
        )}
        {Platform.OS === 'ios' && (Constants?.appOwnership !== 'expo') ? (
          <View style={{ width: '100%', maxWidth: 360, marginTop: spacing(2) }}>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={8}
              style={{ width: '100%', height: 44 }}
              onPress={onApple}
            />
          </View>
        ) : null}
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
