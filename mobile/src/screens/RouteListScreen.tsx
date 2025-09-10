import React, { useEffect, useState, useCallback, memo, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Linking, Platform, Pressable, Animated, AppState, AppStateStatus, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigationTypes';
import { useAuth } from '../auth';
import { fetchTodayRoutes, TodayRoute } from '../api/client';
import { flushQueue, getQueueStats } from '../offlineQueue';
import LoadingOverlay from '../components/LoadingOverlay';
import ThemedButton from '../components/Button';
import { showBanner } from '../components/globalBannerBus';
import { colors, spacing } from '../theme';
import { ensureToday, getCompleted, getInProgress, pruneToIds, syncServerTruth } from '../completed';
import { useFocusEffect } from '@react-navigation/native';

type Props = NativeStackScreenProps<RootStackParamList, 'RouteList'>;

export default function RouteListScreen({ navigation, route }: Props) {
  const { token, signOut } = useAuth();
  const [routes, setRoutes] = useState<TodayRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Banners are now global; local state removed
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [inProgress, setInProgress] = useState<Set<number>>(new Set());

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      setError(null);
      try { await flushQueue(token); } catch {}
      try {
        const stats = await getQueueStats();
        if (stats.pending > 0 && stats.maxAttempts >= 3) {
          showBanner({ type: 'info', message: `Retrying ${stats.pending} submission${stats.pending>1?'s':''} — will auto-resend` });
        }
      } catch {}
      const res = await fetchTodayRoutes(token);
      setRoutes(res.routes);
      try {
        await ensureToday();
        await pruneToIds(res.routes.map(r => r.id));
        // Prefer server truth when present, fall back to local state
        const serverCompleted = new Set<number>();
        const serverInProg = new Set<number>();
        for (const r of res.routes as any[]) {
          if (r.completedToday) serverCompleted.add(r.id);
          if (r.inProgress) serverInProg.add(r.id);
        }
        if (serverCompleted.size || serverInProg.size) {
          // Persist server truth to local storage for consistency across views
          try { await syncServerTruth(Array.from(serverCompleted), Array.from(serverInProg)); } catch {}
          setCompleted(serverCompleted);
          setInProgress(serverInProg);
        } else {
          const [c, p] = await Promise.all([getCompleted(), getInProgress()]);
          setCompleted(c); setInProgress(p);
        }
      } catch {}
    } catch (e: any) {
      const msg = e?.message ?? 'Failed to load routes';
      setError(msg);
      showBanner({ type: 'error', message: msg });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [token]);

  // Sprint 10 — Foreground sync: when app becomes active, flush queue and refresh
  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state === 'active') {
        // Best-effort: flush any pending submissions and refresh routes
        if (token) {
          flushQueue(token).then(async () => {
            try {
              const stats = await getQueueStats();
              if (stats.pending > 0 && stats.maxAttempts >= 3) {
                showBanner({ type: 'info', message: `Retrying ${stats.pending} submission${stats.pending>1?'s':''} — will auto-resend` });
              }
            } catch {}
          }).catch(() => {});
        }
        load();
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [token]);

  // Web-only: also listen for browser coming back online
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = () => {
      if (token) {
        flushQueue(token).then(async () => {
          try {
            const stats = await getQueueStats();
            if (stats.pending > 0 && stats.maxAttempts >= 3) {
              showBanner({ type: 'info', message: `Retrying ${stats.pending} submission${stats.pending>1?'s':''} — will auto-resend` });
            }
          } catch {}
        }).catch(() => {});
      }
      load();
    };
    window.addEventListener('online', handler);
    return () => window.removeEventListener('online', handler);
  }, [token]);

  useFocusEffect(
    React.useCallback(() => {
      // Refresh when returning from details
      load();
      // If header title triggered a dev reset via params, reload local state
      if ((route.params as any)?.devResetTS) {
        getCompleted().then(setCompleted).catch(() => setCompleted(new Set()));
        getInProgress().then(setInProgress).catch(() => setInProgress(new Set()));
        navigation.setParams({ devResetTS: undefined } as any);
      }
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

  // Also react immediately to the hidden dev reset param change (no need to change focus)
  useEffect(() => {
    const ts = (route.params as any)?.devResetTS;
    if (ts) {
      getCompleted().then(setCompleted).catch(() => setCompleted(new Set()));
      getInProgress().then(setInProgress).catch(() => setInProgress(new Set()));
      navigation.setParams({ devResetTS: undefined } as any);
    }
  }, [route.params?.devResetTS]);

  // Handle saved banners routed back from VisitDetail
  useEffect(() => {
    const saved = (route.params as any)?.saved;
    const savedOffline = (route.params as any)?.savedOffline;
    if (saved) {
      showBanner({ type: 'success', message: '✓ Saved' });
      navigation.setParams({ saved: undefined } as any);
    } else if (savedOffline) {
      showBanner({ type: 'info', message: '✓ Saved offline — will sync when online' });
      navigation.setParams({ savedOffline: undefined } as any);
    }
  }, [route.params?.saved, route.params?.savedOffline]);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  };

  const openMaps = useCallback(async (address: string) => {
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
  }, []);

  const onOpenVisit = useCallback((id: number) => {
    navigation.navigate('VisitDetail', { id });
  }, [navigation]);

  const keyExtractor = useCallback((item: TodayRoute) => String(item.id), []);

  type ItemProps = {
    route: TodayRoute;
    isDone: boolean;
    inProg: boolean;
    onOpen: (id: number) => void;
    onOpenMaps: (address: string) => void;
  };

  const RouteListItem = memo(function RouteListItem({ route, isDone, inProg, onOpen, onOpenMaps }: ItemProps) {
    const cardScale = useRef(new Animated.Value(1)).current;
    const onCardPressIn = () => Animated.timing(cardScale, { toValue: 0.98, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    const onCardPressOut = () => Animated.timing(cardScale, { toValue: 1, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    return (
      <Pressable
        onPress={() => onOpen(route.id)}
        onPressIn={onCardPressIn}
        onPressOut={onCardPressOut}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={`Open visit for ${route.clientName}`}
        accessibilityHint="Opens the visit details"
      >
        <Animated.View style={[styles.card, { transform: [{ scale: cardScale }] }] }>
          <View style={styles.rowTop}>
            <View style={styles.leftWrap}>
              <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">{route.clientName || 'Client Name'}</Text>
              <Text style={styles.sub} numberOfLines={1} ellipsizeMode="tail">{route.address || '123 Main St'}</Text>
            </View>
            <View style={styles.centerWrap}>
              <MapButton onPress={() => onOpenMaps(route.address)} label={`Open directions for ${route.clientName}`} />
            </View>
            <MemoCheck done={isDone} progress={inProg && !isDone} label={isDone ? 'Completed' : inProg ? 'In progress' : 'Not started'} />
          </View>
        </Animated.View>
      </Pressable>
    );
  }, (prev, next) =>
    prev.route.id === next.route.id &&
    prev.route.clientName === next.route.clientName &&
    prev.route.address === next.route.address &&
    prev.isDone === next.isDone &&
    prev.inProg === next.inProg
  );

  const MemoCheck = memo(function Check({ done, progress, label }: { done: boolean; progress: boolean; label: string }) {
    const scale = useRef(new Animated.Value(done ? 1 : 0.9)).current;
    const opacity = useRef(new Animated.Value(done ? 1 : 0)).current;
    useEffect(() => {
      if (done) {
        Animated.parallel([
          Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 10 }),
          Animated.timing(opacity, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]).start();
      } else {
        opacity.setValue(0);
        scale.setValue(0.9);
      }
    }, [done]);
    return (
      <View
        style={[styles.checkBadge, done ? styles.checkBadgeDone : progress ? styles.checkBadgeInProgress : null]}
        accessibilityRole="image"
        accessibilityLabel={label}
      >
        <Animated.Text style={[styles.checkMark, styles.checkMarkDone, { opacity, transform: [{ scale }] }]}>✓</Animated.Text>
      </View>
    );
  }, (prev, next) => prev.done === next.done && prev.progress === next.progress && prev.label === next.label);

  const MapButton = ({ onPress, label }: { onPress: () => void; label: string }) => {
    const scale = useRef(new Animated.Value(1)).current;
    const onPressIn = () => Animated.timing(scale, { toValue: 0.96, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    const onPressOut = () => Animated.timing(scale, { toValue: 1, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    return (
      <Pressable
        style={styles.mapBtn}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Opens maps with driving directions"
      >
        <Animated.View style={[styles.mapBtnInner, { transform: [{ scale }] }]}>
          <Text style={styles.mapBtnText}>Map</Text>
          <Text style={styles.mapBtnArrow}>›</Text>
        </Animated.View>
      </Pressable>
    );
  };

  return (
    <>
      {error ? (
        <View style={styles.errorWrap}>
          <ThemedButton title="Retry" variant="outline" onPress={load} style={styles.retryBtn} />
        </View>
      ) : null}
      <FlatList
        style={styles.list}
        contentContainerStyle={[styles.listContent, { paddingBottom: spacing(16) }]}
        data={routes}
        keyExtractor={keyExtractor}
        initialNumToRender={8}
        windowSize={7}
        removeClippedSubviews
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <RouteListItem
            route={item}
            isDone={completed.has(item.id)}
            inProg={inProgress.has(item.id)}
            onOpen={onOpenVisit}
            onOpenMaps={openMaps}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No visits today</Text>
            <Text style={styles.emptySub}>Pull down to refresh</Text>
          </View>
        }
      />
      <SafeAreaView edges={['bottom']} style={styles.stickyBar}>
        {/* Log Out exits the session (same action as header Sign Out) */}
        <ThemedButton title="Log Out" onPress={signOut} style={styles.submitBtn} />
      </SafeAreaView>
      <LoadingOverlay visible={loading || refreshing} />
    </>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.background },
  listContent: { padding: spacing(4) },
  // global banner handles app-wide messages now
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
  // Softer warning tone for in-progress state
  checkBadgeInProgress: { backgroundColor: '#fee2e2', borderColor: '#fecaca' },
  checkMark: { color: colors.muted, fontSize: 22, fontWeight: '900' },
  checkMarkDone: { color: colors.primary },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing(20) },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: spacing(1) },
  emptySub: { color: colors.muted },
  banner: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: colors.successBg, padding: spacing(2), alignItems: 'center', zIndex: 2, borderBottomWidth: 1, borderColor: colors.border },
  bannerText: { color: colors.successText, fontWeight: '600' },
  errorWrap: { paddingHorizontal: spacing(4), marginTop: spacing(2) },
  retryBtn: { alignSelf: 'flex-start', marginTop: spacing(2) },
  stickyBar: { position: 'absolute', left: 0, right: 0, bottom: spacing(4), padding: spacing(3), paddingBottom: spacing(5), backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border },
  submitBtn: { alignSelf: 'center', minWidth: 240, maxWidth: 360 },
});
