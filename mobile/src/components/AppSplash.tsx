import React from 'react';
import { ImageBackground, StyleSheet } from 'react-native';

export default function AppSplash(): JSX.Element {
  return (
    <ImageBackground
      // remote bundler error references palms.jpg — ensure this exact require exists
      source={require('../../assets/palms.jpg')}
      resizeMode="cover"
      style={styles.bg}
      accessibilityLabel="Loading"
    />
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
});