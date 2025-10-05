import React from 'react';
import { ImageBackground, StyleSheet, ImageSourcePropType } from 'react-native';

// ensure both asset paths are referenced so Metro includes them in the bundle
const palmsSplash = require('../../assets/palms_splash.jpg');
const palmsLegacy = require('../../assets/palms.jpg');

export default function AppSplash(): JSX.Element {
  const source: ImageSourcePropType = palmsSplash || palmsLegacy;
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