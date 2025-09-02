import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { useAuth } from '../auth';
import { fetchTodayRoutes, TodayRoute } from '../api/client';
import LoadingOverlay from '../components/LoadingOverlay';
import { useFocusEffect } from '@react-navigation/native';

type Props = NativeStackScreenProps<RootStackParamList, 'RouteList'>;

export default function RouteListScreen({ navigation, route }: Props) {
  const { token } = useAuth();
  const [routes, setRoutes] = useState<TodayRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetchTodayRoutes(token);
      setRoutes(res.routes);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [token]);

  useFocusEffect(
    React.useCallback(() => {
      // Refresh when returning from details
      load();
      if (route.params?.saved) {
        setSavedBanner(true);
        const t = setTimeout(() => setSavedBanner(false), 2000);
        // Clear the param so it doesn't re-show
        navigation.setParams({ saved: undefined } as any);
        return () => clearTimeout(t);
      }
      }, [token])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  };

  return (
    <>
      {savedBanner ? <View style={styles.banner}><Text style={styles.bannerText}>Saved</Text></View> : null}
      <FlatList
      style={styles.list}
      data={routes}
      keyExtractor={(item) => String(item.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('VisitDetail', { id: item.id })}>
          <Text style={styles.title}>{item.clientName}</Text>
          <Text style={styles.sub}>{item.address}</Text>
          <Text style={styles.sub}>Time: {item.scheduledTime}</Text>
        </TouchableOpacity>
      )}
      ListEmptyComponent={<View style={styles.center}><Text>No visits today</Text></View>}
    />
      <LoadingOverlay visible={loading || refreshing} />
    </>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#fff' },
  card: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  title: { fontSize: 16, fontWeight: '700' },
  sub: { color: '#555' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' }
  ,banner: { backgroundColor: '#e6ffed', padding: 8, alignItems: 'center' }
  ,bannerText: { color: '#047857', fontWeight: '600' }
});
