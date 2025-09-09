import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Linking, Platform, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigationTypes';
import { useAuth } from '../auth';
import { fetchTodayRoutes, TodayRoute } from '../api/client';
import { flushQueue } from '../offlineQueue';
import LoadingOverlay from '../components/LoadingOverlay';
import ThemedButton from '../components/Button';
import Banner from '../components/Banner';
import { colors, spacing } from '../theme';
import { getCompleted, getInProgress } from '../completed';
import { useFocusEffect } from '@react-navigation/native';

type Props = NativeStackScreenProps<RootStackParamList, 'RouteList'>;

export default function RouteListScreen({ navigation, route }: Props) {
  const { token } = useAuth();
  const [routes, setRoutes] = useState<TodayRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savedBanner, setSavedBanner] = useState<false | 'online' | 'offline'>(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [inProgress, setInProgress] = useState<Set<number>>(new Set());

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      setError(null);
      try { await flushQueue(token); } catch {}
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
    getCompleted().then(setCompleted).catch(() => setCompleted(new Set()));
    getInProgress().then(setInProgress).catch(() => setInProgress(new Set()));
  }, [token]);

  useFocusEffect(
    React.useCallback(() => {
      // Refresh when returning from details
      load();
      getCompleted().then(setCompleted).catch(() => setCompleted(new Set()));
      getInProgress().then(setInProgress).catch(() => setInProgress(new Set()));
      if (route.params?.saved) {
        setSavedBanner('online');
        const t = setTimeout(() => setSavedBanner(false), 2500);
        // Clear the param so it doesn't re-show
        navigation.setParams({ saved: undefined } as any);
        return () => clearTimeout(t);
      }
      if ((route.params as any)?.savedOffline) {
        setSavedBanner('offline');
        const t = setTimeout(() => setSavedBanner(false), 3000);
        navigation.setParams({ savedOffline: undefined } as any);
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
          <Text style={styles.bannerText}>{savedBanner === 'offline' ? '✓ Saved offline — will sync when online' : '✓ Saved'}</Text>
        </View>
      ) : null}
      {error ? (
        <View style={styles.errorWrap}>
          <Banner type="error" message={error} />
          <ThemedButton title="Retry" variant="outline" onPress={load} style={styles.retryBtn} />
        </View>
      ) : null}
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
              <View style={styles.centerWrap}>
                <TouchableOpacity style={styles.mapBtn} onPress={() => openMaps(item.address)} accessibilityRole="button" accessibilityLabel={`Open directions for ${item.clientName}`}>
                  <View style={styles.mapBtnInner}>
                    <Text style={styles.mapBtnText}>Map</Text>
                    <Text style={styles.mapBtnArrow}>›</Text>
                  </View>
                </TouchableOpacity>
              </View>
              <View style={[
                styles.checkBadge,
                completed.has(item.id) ? styles.checkBadgeDone : inProgress.has(item.id) ? styles.checkBadgeInProgress : null
              ]}
                accessibilityLabel={completed.has(item.id) ? 'Completed' : inProgress.has(item.id) ? 'In progress' : 'Not started'}
                accessibilityRole="image"
              >
                {completed.has(item.id) ? (
                  <Text style={[styles.checkMark, styles.checkMarkDone]}>✓</Text>
                ) : null}
              </View>
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
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', position: 'relative' },
  // Further bias to the right to tighten space to the circle
  centerWrap: { position: 'absolute', left: '50%', width: 88, alignItems: 'center', justifyContent: 'center', transform: [{ translateX: -28 }] },
  leftWrap: { flexGrow: 1, flexShrink: 1, minWidth: 0, paddingRight: spacing(2) + 96 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  dot: { color: colors.muted },
  sub: { color: colors.muted, marginTop: spacing(1) },
  mapBtn: { paddingVertical: spacing(1), paddingHorizontal: spacing(2), borderRadius: 8, borderWidth: 1, borderColor: colors.muted, flexShrink: 0, backgroundColor: 'transparent' },
  mapBtnInner: { flexDirection: 'row', alignItems: 'center', gap: spacing(0.5) },
  mapBtnText: { color: colors.primary, fontWeight: '600', fontSize: 16 },
  mapBtnArrow: { color: colors.primary, fontWeight: '900', fontSize: 36, marginTop: -2 },
  checkBadge: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center', marginRight: 0 },
  checkBadgeDone: { borderColor: colors.muted, backgroundColor: '#fff' },
  checkBadgeInProgress: { backgroundColor: colors.danger, borderColor: colors.danger },
  checkMark: { color: colors.muted, fontSize: 22, fontWeight: '900' },
  checkMarkDone: { color: colors.primary },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing(20) },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: spacing(1) },
  emptySub: { color: colors.muted },
  banner: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: colors.successBg, padding: spacing(2), alignItems: 'center', zIndex: 2, borderBottomWidth: 1, borderColor: colors.border },
  bannerText: { color: colors.successText, fontWeight: '600' },
  errorWrap: { paddingHorizontal: spacing(4), marginTop: spacing(2) },
  retryBtn: { alignSelf: 'flex-start', marginTop: spacing(2) },
});
