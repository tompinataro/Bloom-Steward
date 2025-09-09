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
// Extra components used inside screens, included here for dev-time checks
import LoadingOverlay from './src/components/LoadingOverlay';
import ThemedButton from './src/components/Button';
import Banner from './src/components/Banner';
import ErrorBoundary from './src/components/ErrorBoundary';

const Stack = createStackNavigator<RootStackParamList>();

// Temporary flags to isolate iOS error sources
const FORCE_HELLO = false; // show only Hello within NavigationContainer
const FORCE_NAVLESS = false; // render without any navigation at all

function HelloScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 22, fontWeight: '700' }}>Hello from Bloom Steward</Text>
      <Text style={{ marginTop: 8 }}>If you see this, navigation works.</Text>
    </View>
  );
}

// Dev-only sanity check to surface undefined component imports clearly
if (__DEV__) {
  const comps: Record<string, any> = {
    HomeScreen,
    AboutScreen,
    LoginScreen,
    RouteListScreen,
    VisitDetailScreen,
    SignOutButton,
    AppSplash,
  };
  Object.entries(comps).forEach(([key, val]) => {
    // eslint-disable-next-line no-console
    console.log('[Screen check]', key, typeof val, val?.name || val?.displayName || '');
    if (val == null) {
      // eslint-disable-next-line no-console
      console.warn(`[Screen check] ${key} is undefined — check its import/export.`);
    }
  });
}

function RootNavigator() {
  const { token, loading } = useAuth();
  const wrap = (name: string, C: any) => (props: any) => {
    // eslint-disable-next-line no-console
    if (__DEV__) console.log('[Render screen]', name);
    return (
      <ErrorBoundary>
        <C {...props} />
      </ErrorBoundary>
    );
  };
  // Dev-only guard: if any imported components are undefined, surface it visually
  if (__DEV__) {
    const comps: Record<string, any> = {
      HomeScreen,
      AboutScreen,
      LoginScreen,
      RouteListScreen,
      VisitDetailScreen,
      SignOutButton,
      AppSplash,
      LoadingOverlay,
      ThemedButton,
      Banner,
    };
    const missing = Object.entries(comps)
      .filter(([, v]) => v == null)
      .map(([k]) => k);
    if (missing.length) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12 }}>Dev Check Failed</Text>
          <Text style={{ marginBottom: 8 }}>These imports are undefined:</Text>
          {missing.map((m) => (
            <Text key={m} style={{ color: 'crimson' }}>• {m}</Text>
          ))}
          <Text style={{ marginTop: 12, opacity: 0.7 }}>Fix the import/export for the items above.</Text>
        </View>
      );
    }
  }
  // Simple splash while restoring token
  if (loading) {
    return <AppSplash />;
  }
  return token ? (
    <Stack.Navigator initialRouteName="RouteList" screenOptions={{ headerTitleAlign: 'center', headerTitleStyle: { fontWeight: '700' } }}>
      <Stack.Screen name="RouteList" component={wrap('RouteList', RouteListScreen)} options={{ title: 'Today\'s Route' }} />
      <Stack.Screen
        name="VisitDetail"
        component={wrap('VisitDetail', VisitDetailScreen)}
        options={({ navigation }) => ({
          title: 'Visit',
          headerBackTitleVisible: false,
          headerLeft: () => (
            <Pressable
              onPress={() => navigation.goBack()}
              style={{ paddingHorizontal: 8, paddingVertical: 0, transform: [{ translateY: -6 }] }}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Text style={{ fontSize: 44, fontWeight: '700', letterSpacing: 0.5, lineHeight: 40 }}>{'‹ ‹ ‹'}</Text>
            </Pressable>
          ),
          headerTitleStyle: { fontWeight: '700', fontSize: 20 },
        })}
      />
      <Stack.Screen name="About" component={wrap('About', AboutScreen)} />
      <Stack.Screen name="Home" component={wrap('Home', HomeScreen)} />
    </Stack.Navigator>
  ) : (
    <Stack.Navigator initialRouteName="Login">
      <Stack.Screen name="Login" component={wrap('Login', LoginScreen)} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

export default function App() {
  if (FORCE_NAVLESS) {
    return (
      <AuthProvider>
        <ErrorBoundary>
          <StatusBar style="auto" />
          <HelloScreen />
        </ErrorBoundary>
      </AuthProvider>
    );
  }
  return (
    <AuthProvider>
      <ErrorBoundary>
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
        {FORCE_HELLO ? (
          <Stack.Navigator>
            <Stack.Screen name="Hello" component={HelloScreen} />
          </Stack.Navigator>
        ) : (
          <RootNavigator />
        )}
      </NavigationContainer>
      </ErrorBoundary>
    </AuthProvider>
  );
}
