import React from 'react';
import { ImageBackground, StyleSheet } from 'react-native';

// Temporary: load splash from GitHub raw URL to avoid Metro require resolution issues in EAS.
// Replace with local require('../../assets/palms.jpg') once bundler issue is resolved.
const REMOTE_SPLASH =
  'https://raw.githubusercontent.com/tompinataro/Bloom-Steward/main/mobile/assets/palms.jpg';

export default function AppSplash(): JSX.Element {
  return (
    <ImageBackground
      source={{ uri: REMOTE_SPLASH }}
      resizeMode="cover"
      style={styles.bg}
      accessibilityLabel="Loading"
    />
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
});