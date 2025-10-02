import React from 'react';
import { StyleSheet, View } from 'react-native';

export default function AppSplash() {
  return <View style={styles.screen} accessibilityLabel="Loading" />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#e7bfbf' },
});
