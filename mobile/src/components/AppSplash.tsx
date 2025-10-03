import React from 'react';
import { ImageBackground, StyleSheet } from 'react-native';

export default function AppSplash(): JSX.Element {
  return (
    <ImageBackground
      source={require('../../assets/palms.png')}
      resizeMode="cover"
      style={styles.bg}
      accessibilityLabel="Loading"
    />
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
});