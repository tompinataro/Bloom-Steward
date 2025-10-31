import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteAccount as apiDeleteAccount, login as apiLogin, LoginResponse, refresh as apiRefresh, setUnauthorizedHandler, setTokenRefreshedHandler } from './api/client';
import { showBanner } from './components/globalBannerBus';

type AuthState = {
  token: string | null;
  user: LoginResponse['user'] | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithApple: (data: { identityToken?: string; authorizationCode?: string; email?: string | null; name?: string | null }) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: (options?: { reason?: string }) => Promise<{ ok: boolean; deleted?: boolean; requiresManualCleanup?: boolean }>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<LoginResponse['user'] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [t, u] = await Promise.all([
          AsyncStorage.getItem('auth_token'),
          AsyncStorage.getItem('auth_user')
        ]);
        if (t) setToken(t);
        if (u) setUser(JSON.parse(u));
        // Best-effort: refresh token on startup to extend session
        if (t) {
          try {
            const res = await apiRefresh(t);
            setToken(res.token);
            setUser(res.user);
            await AsyncStorage.setItem('auth_token', res.token);
            await AsyncStorage.setItem('auth_user', JSON.stringify(res.user));
          } catch {
            // ignore; user may be offline or token still fresh
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Auto sign-out on 401s from API client
  useEffect(() => {
    setUnauthorizedHandler(async () => {
      try { showBanner({ type: 'error', message: 'Session expired — please sign in.' }); } catch {}
      setToken(null);
      setUser(null);
      try {
        await AsyncStorage.removeItem('auth_token');
        await AsyncStorage.removeItem('auth_user');
      } catch {}
    });
    setTokenRefreshedHandler(async (newToken, newUser) => {
      try {
        setToken(newToken);
        if (newUser) setUser(newUser);
        await AsyncStorage.setItem('auth_token', newToken);
        if (newUser) await AsyncStorage.setItem('auth_user', JSON.stringify(newUser));
      } catch {}
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const signIn = async (email: string, password: string) => {
    const res = await apiLogin(email, password);
    setToken(res.token);
    setUser(res.user);
    await AsyncStorage.setItem('auth_token', res.token);
    await AsyncStorage.setItem('auth_user', JSON.stringify(res.user));
  };

  const signInWithApple = async (data: { identityToken?: string; authorizationCode?: string; email?: string | null; name?: string | null }) => {
    const { loginWithApple } = await import('./api/client');
    const res = await loginWithApple(data);
    setToken(res.token);
    setUser(res.user);
    await AsyncStorage.setItem('auth_token', res.token);
    await AsyncStorage.setItem('auth_user', JSON.stringify(res.user));
  };

  const performSignOut = async () => {
    setToken(null);
    setUser(null);
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('auth_user');
  };

  const signOut = async () => {
    await performSignOut();
  };

  const deleteAccount: AuthState['deleteAccount'] = async (options) => {
    if (!token) throw new Error('Not authenticated');
    const result = await apiDeleteAccount(token, options);
    await performSignOut();
    return result;
  };

  return <AuthContext.Provider value={{ token, user, loading, signIn, signInWithApple, signOut, deleteAccount }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// Foreground refresh: global effect inside module
// Note: runs once; relies on AuthProvider state updates via storage
if (typeof AppState !== 'undefined') {
  let lastState: AppStateStatus = AppState.currentState as AppStateStatus;
  AppState.addEventListener('change', async (state) => {
    try {
      if (state === 'active' && lastState !== 'active') {
        const t = await AsyncStorage.getItem('auth_token');
        if (t) {
          try {
            const res = await apiRefresh(t);
            await AsyncStorage.setItem('auth_token', res.token);
            await AsyncStorage.setItem('auth_user', JSON.stringify(res.user));
          } catch {
            // ignore; offline or token still valid
          }
        }
      }
    } finally {
      lastState = state;
    }
  });
}
