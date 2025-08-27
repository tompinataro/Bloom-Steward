import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";

export default function HealthCheck() {
  const [status, setStatus] = useState<string>("Loading...");

  useEffect(() => {
    const check = async () => {
      try {
        const base = process.env.EXPO_PUBLIC_API_URL!;
        const res = await fetch(`${base}/health`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setStatus(`OK ✅ ${JSON.stringify(data)}`);
      } catch (err: any) {
        setStatus(`Error ❌ ${err.message}`);
      }
    };

    check();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Health Check Result:</Text>
      <Text style={styles.result}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    marginTop: 50,
  },
  text: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 10,
  },
  result: {
    fontSize: 16,
    color: "blue",
  },
});