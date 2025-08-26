import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  console.log('✅ App rendered');
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bloom Steward mobile is live 🎉</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eef' },
  title: { fontSize: 20 },
});