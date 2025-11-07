import React, { useEffect } from 'react';
import { Text, Pressable, View, Platform, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthProvider, useAuth } from './src/auth';
import { colors } from './src/theme';
import type { RootStackParamList } from './src/navigationTypes';

import HomeScreen from './src/screens/HomeScreen';
import AboutScreen from './src/screens/AboutScreen';
import LoginScreen from './src/screens/LoginScreen';
import RouteListScreen from './src/screens/RouteListScreen';
import VisitDetailScreen from './src/screens/VisitDetailScreen';
import { GlobalBannerProvider } from './src/components/GlobalBannerProvider';
import { adminResetVisitState } from './src/api/client';
import Constants from 'expo-constants';
import DeleteAccountScreen from './src/screens/DeleteAccountScreen';
import AccountScreen from './src/screens/AccountScreen';

const Stack = createStackNavigator<RootStackParamList>();

function RootNavigator() {
  const { token, loading } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#e7bfbf', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  return token ? (
    <Stack.Navigator initialRouteName="RouteList" screenOptions={{ headerTitleAlign: 'center', headerTitleStyle: { fontWeight: '700' } }}>
      <Stack.Screen
        name="RouteList"
        component={RouteListScreen}
        options={({ navigation }) => ({
          // Dev-only: secret clickable title to reset local completion state during demos
          // (No visual change — behaves like regular title text)
          headerTitle: () => (
            <Pressable onPress={async () => {
              const { clearAllProgress } = await import('./src/completed');
              try { await clearAllProgress(); } catch {}
              try { navigation.setParams({ devResetTS: Date.now() } as any); } catch {}
            }} onLongPress={async () => {
              const { clearAllProgress } = await import('./src/completed');
              try { await clearAllProgress(); } catch {}
              try { navigation.setParams({ devResetTS: Date.now() } as any); } catch {}
            }} hitSlop={12} accessibilityRole="button" accessibilityLabel="Today's Route (Dev Reset)">
              <Text style={{ fontWeight: '700', fontSize: 17 }}>Today{"'"}s Route</Text>
            </Pressable>
          ),
          // Dev/Admin: server-state reset button (staging/demo convenience)
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable
                onPress={() => navigation.navigate('Account')}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Manage account"
                style={{ paddingHorizontal: 12, paddingVertical: 4 }}
              >
                <Text style={{ color: colors.primary, fontWeight: '600', marginRight: __DEV__ ? 8 : 0 }}>Account</Text>
              </Pressable>
              {(__DEV__) ? (
                <Pressable
                  onPress={async () => {
                    try {
                      if (!token) return;
                      await adminResetVisitState(undefined, token);
                      navigation.setParams({ devResetTS: Date.now() } as any);
                    } catch {}
                  }}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Reset server visit state"
                  style={{ paddingHorizontal: 12, paddingVertical: 4 }}
                >
                  <Text style={{ color: colors.primary, fontWeight: '600' }}>Reset</Text>
                </Pressable>
              ) : null}
            </View>
          ),
        })}
      />
      <Stack.Screen
        name="VisitDetail"
        component={VisitDetailScreen}
        options={({ navigation }) => ({
          title: 'Visit',
          headerBackTitleVisible: false,
          headerLeft: () => (
            <Pressable
              onPress={() => navigation.goBack()}
              style={{ paddingLeft: 28, paddingRight: 8, paddingVertical: 0, transform: [{ translateY: 2 }] }}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Text style={{ fontSize: 44, fontWeight: '700', lineHeight: 44 }}>{'‹'}</Text>
            </Pressable>
          ),
          headerTitleStyle: { fontWeight: '700', fontSize: 20 },
        })}
      />
      <Stack.Screen name="About" component={AboutScreen} />
      <Stack.Screen name="Account" component={AccountScreen} options={{ title: 'Account' }} />
      <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} options={{ title: 'Delete Account' }} />
      <Stack.Screen name="Home" component={HomeScreen} />
    </Stack.Navigator>
  ) : (
    <Stack.Navigator initialRouteName="Login">
      <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

export default function App() {
  useEffect(() => {
    // Only enable background tasks in standalone production builds.
    // In Expo Go or Dev Client (appOwnership 'expo' or 'guest'), these native modules
    // may not be linked and importing them will crash. Skip when __DEV__ is true.
    const ownership = (Constants as any)?.appOwnership;
    const isStandalone = ownership === 'standalone';
    if (!__DEV__ && Platform.OS !== 'web' && isStandalone) {
      import('./src/background').then(m => m.registerBackgroundSync?.()).catch(() => {});
    }
  }, []);
  return (
    <AuthProvider>
      <GlobalBannerProvider>
      <NavigationContainer theme={{
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          primary: colors.primary,
          background: colors.background,
          card: colors.card,
          text: colors.text,
          border: colors.border,
        },
      }}>
        <StatusBar style="auto" />
        <RootNavigator />
      </NavigationContainer>
      </GlobalBannerProvider>
    </AuthProvider>
  );
}
