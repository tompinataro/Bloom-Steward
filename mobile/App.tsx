import React from 'react';
import { SafeAreaView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import HealthCheck from './src/HealthCheck';

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <HealthCheck />
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}
