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
          <Text style={styles.rightsText}>All Rights Reserved. ©️ 2024, 2025</Text>
        </View>
        <Text style={styles.heading}>The Field Tech&#39;s Favorite Dashboard</Text>
        <Text style={styles.subtitle}>A Tixpy App</Text>
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
  heading: { fontSize: 22, fontWeight: '700', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 13, color: colors.muted, textAlign: 'center' },
  rightsText: { position: 'absolute', bottom: 8, left: 12, right: 12, textAlign: 'center', fontSize: 11, color: colors.muted },
  footer: {
    width: '100%',
    maxWidth: 420,
    padding: spacing(6),
    alignSelf: 'center',
  },
  fullWidthBtn: { alignSelf: 'stretch' },
});
