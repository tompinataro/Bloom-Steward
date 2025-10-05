import React from 'react';
import { ImageBackground, StyleSheet, ImageSourcePropType } from 'react-native';

// use a known existing asset to avoid Metro failing on a missing palms.jpg
const palmsSplash = require('../../assets/palms_splash.jpg');

export default function AppSplash(): JSX.Element {
  const source: ImageSourcePropType = palmsSplash;
  return (
    <ImageBackground
      source={source}
      resizeMode="cover"
      style={styles.bg}
      accessibilityLabel="Loading"
    />
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
});