import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Linking, Platform, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { useAuth } from '../auth';
import { fetchTodayRoutes, TodayRoute } from '../api/client';
import LoadingOverlay from '../components/LoadingOverlay';
import Banner from '../components/Banner';
import { colors, spacing } from '../theme';
import { useFocusEffect } from '@react-navigation/native';

type Props = NativeStackScreenProps<RootStackParamList, 'RouteList'>;

export default function RouteListScreen({ navigation, route }: Props) {
  const { token } = useAuth();
  const [routes, setRoutes] = useState<TodayRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      setError(null);
      const res = await fetchTodayRoutes(token);
      setRoutes(res.routes);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load routes');
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
        const t = setTimeout(() => setSavedBanner(false), 2500);
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

  const openMaps = async (address: string) => {
    const q = encodeURIComponent(address);
    // Prefer Google Maps directions. Fallback to web if app isn't available.
    if (Platform.OS === 'ios') {
      const googleScheme = `comgooglemaps://?daddr=${q}&directionsmode=driving`;
      const web = `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=driving`;
      const can = await Linking.canOpenURL('comgooglemaps://');
      await Linking.openURL(can ? googleScheme : web).catch(() => {});
      return;
    }
    if (Platform.OS === 'android') {
      const intent = `google.navigation:q=${q}&mode=d`;
      const web = `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=driving`;
      await Linking.openURL(intent).catch(async () => {
        await Linking.openURL(web).catch(() => {});
      });
      return;
    }
    const web = `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=driving`;
    Linking.openURL(web).catch(() => {});
  };

  return (
    <>
      {savedBanner ? (
        <View style={styles.banner} accessibilityRole="status" accessibilityLabel="Saved">
          <Text style={styles.bannerText}>✓ Saved</Text>
        </View>
      ) : null}
      {error ? <View style={{ paddingHorizontal: spacing(4) }}><Banner type="error" message={error} /></View> : null}
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={routes}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('VisitDetail', { id: item.id })}
            accessibilityRole="button"
            accessibilityLabel={`Open visit for ${item.clientName}`}
          >
            <View style={styles.rowTop}>
              <View style={styles.leftWrap}>
                <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">{item.clientName || 'Client Name'}</Text>
                <Text style={styles.sub} numberOfLines={1} ellipsizeMode="tail">{item.address || '123 Main St'}</Text>
              </View>
              <TouchableOpacity style={styles.mapBtn} onPress={() => openMaps(item.address)} accessibilityRole="button" accessibilityLabel={`Open directions for ${item.clientName}`}>
                <Text style={styles.mapBtnText}>Map &gt;</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No visits today</Text>
            <Text style={styles.emptySub}>Pull down to refresh</Text>
          </View>
        }
      />
      <LoadingOverlay visible={loading || refreshing} />
    </>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.background },
  listContent: { padding: spacing(4) },
  card: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    padding: spacing(3),
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: spacing(3),
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  leftWrap: { flexGrow: 1, flexShrink: 1, minWidth: 0, paddingRight: spacing(2) },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  dot: { color: colors.muted },
  sub: { color: colors.muted, marginTop: spacing(1) },
  mapBtn: { paddingVertical: spacing(2), paddingHorizontal: spacing(3), borderRadius: 8, borderWidth: 1, borderColor: colors.primary, flexShrink: 0 },
  mapBtnText: { color: colors.primary, fontWeight: '600' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing(20) },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: spacing(1) },
  emptySub: { color: colors.muted },
  banner: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: colors.successBg, padding: spacing(2), alignItems: 'center', zIndex: 2, borderBottomWidth: 1, borderColor: colors.border },
  bannerText: { color: colors.successText, fontWeight: '600' },
});
