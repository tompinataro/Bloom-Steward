import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigationTypes';
import ThemedButton from '../components/Button';
import { colors, spacing } from '../theme';

export default function LoginLandingScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoFrame}>
          <Image source={require('../../assets/brand-logo.png')} style={styles.logo} resizeMode="contain" />
        </View>
        <Text style={styles.heading}>FT Mobile Dashboard</Text>
        <Text style={styles.subtitle}>Field Tech Management</Text>
      </View>
      <View style={styles.footer}>
        <ThemedButton
          title="Log In"
          onPress={() => navigation.navigate('LoginForm')}
          style={styles.fullWidthBtn}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    gap: spacing(3),
    padding: spacing(6),
    justifyContent: 'center',
    alignSelf: 'center',
  },
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
  },
  logo: { width: '92%', height: '92%' },
  heading: { fontSize: 28, fontWeight: '700', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 16, color: colors.muted, textAlign: 'center' },
  footer: {
    width: '100%',
    maxWidth: 420,
    padding: spacing(6),
    alignSelf: 'center',
  },
  fullWidthBtn: { alignSelf: 'stretch' },
});
