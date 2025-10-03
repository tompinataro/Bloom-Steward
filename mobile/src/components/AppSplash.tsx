import React from 'react';
import { ImageBackground, StyleSheet } from 'react-native';

// use explicit local require to ensure Metro bundles the image
export default function AppSplash(): JSX.Element {
  return (
    <ImageBackground
      source={require('../../assets/palms_splash.jpg')}
      resizeMode="cover"
      style={styles.bg}
      accessibilityLabel="Loading"
    />
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
});