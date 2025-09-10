import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../theme';
import { BannerMsg, setBannerHandler } from './globalBannerBus';

type Ctx = { show: (msg: BannerMsg) => void; hide: () => void };
const C = createContext<Ctx | undefined>(undefined);

export function GlobalBannerProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<BannerMsg | null>(null);
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (timer) { clearTimeout(timer); setTimer(null); }
    setMsg(null);
  }, [timer]);

  const show = useCallback((m: BannerMsg) => {
    if (timer) { clearTimeout(timer); setTimer(null); }
    setMsg(m);
    const t = setTimeout(() => setMsg(null), m.durationMs ?? (m.type === 'error' ? 5000 : 2500));
    setTimer(t);
  }, [timer]);

  useEffect(() => {
    setBannerHandler(show);
    return () => setBannerHandler(null);
  }, [show]);

  const value = useMemo(() => ({ show, hide }), [show, hide]);

  return (
    <C.Provider value={value}>
      {children}
      {msg ? (
        <View style={[styles.banner, msg.type === 'error' ? styles.error : msg.type === 'success' ? styles.success : styles.info]} accessibilityRole="status" accessibilityLabel={msg.type === 'error' ? 'Error' : msg.type === 'success' ? 'Saved' : 'Notice'}>
          <Text style={styles.text}>{msg.message}</Text>
        </View>
      ) : null}
    </C.Provider>
  );
}

export function useGlobalBanner() {
  const ctx = useContext(C);
  if (!ctx) throw new Error('useGlobalBanner must be used within GlobalBannerProvider');
  return ctx;
}

const styles = StyleSheet.create({
  banner: { position: 'absolute', top: 0, left: 0, right: 0, paddingVertical: spacing(2), paddingHorizontal: spacing(4), borderBottomWidth: 1, zIndex: 1000 },
  text: { textAlign: 'center', fontWeight: '600' },
  info: { backgroundColor: '#eef2ff', borderColor: '#c7d2fe' },
  success: { backgroundColor: colors.successBg, borderColor: '#86efac' },
  error: { backgroundColor: '#fee2e2', borderColor: '#fecaca' },
});

