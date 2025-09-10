import React from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';

export default function AppSplash() {
  return (
    <ImageBackground
      source={require('../../assets/palms.jpg')}
      resizeMode="cover"
      style={styles.bg}
      accessibilityLabel="Loading"
      accessibilityRole="image"
    >
      <View />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
});

