import React from 'react';
import { Text, Pressable, View } from 'react-native';
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
import SignOutButton from './src/components/SignOutButton';
import AppSplash from './src/components/AppSplash';
import { adminResetVisitState } from './src/api/client';
import { Platform, useEffect } from 'react';
import { registerBackgroundSync } from './src/background';

const Stack = createStackNavigator<RootStackParamList>();

function RootNavigator() {
  const { token, loading } = useAuth();
  // Simple splash while restoring token
  if (loading) {
    return <AppSplash />;
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
            (__DEV__) ? (
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
            ) : null
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
    if (Platform.OS !== 'web') {
      registerBackgroundSync().catch(() => {});
    }
  }, []);
  return (
    <AuthProvider>
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
    </AuthProvider>
  );
}
