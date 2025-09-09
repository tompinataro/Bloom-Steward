import React from 'react';
import { Text, Pressable, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from './src/auth';
import { colors } from './src/theme';

import HomeScreen from './src/screens/HomeScreen';
import AboutScreen from './src/screens/AboutScreen';
import LoginScreen from './src/screens/LoginScreen';
import RouteListScreen from './src/screens/RouteListScreen';
// Temporarily stub VisitDetail to isolate native error
// import VisitDetailScreen from './src/screens/VisitDetailScreen';
import SignOutButton from './src/components/SignOutButton';
import AppSplash from './src/components/AppSplash';
// Extra components used inside screens, included here for dev-time checks
import LoadingOverlay from './src/components/LoadingOverlay';
import ThemedButton from './src/components/Button';
import Banner from './src/components/Banner';

export type RootStackParamList = {
  Login: undefined;
  RouteList: { saved?: boolean; savedOffline?: boolean } | undefined;
  VisitDetail: { id: number };
  Home: undefined;
  About: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Dev-only sanity check to surface undefined component imports clearly
if (__DEV__) {
  const comps: Record<string, any> = {
    HomeScreen,
    AboutScreen,
    LoginScreen,
    RouteListScreen,
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

function VisitDetailStub() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Visit Detail</Text>
    </View>
  );
}

function RootNavigator() {
  const { token, loading } = useAuth();
  // Dev-only guard: if any imported components are undefined, surface it visually
  if (__DEV__) {
    const comps: Record<string, any> = {
      HomeScreen,
      AboutScreen,
      LoginScreen,
      RouteListScreen,
      VisitDetailStub,
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
    <Stack.Navigator screenOptions={{ headerTitleAlign: 'center', headerTitleStyle: { fontWeight: '700' } }}>
      <Stack.Screen name="RouteList" component={RouteListScreen} options={{ title: 'Today\'s Route', headerRight: () => <SignOutButton /> }} />
      <Stack.Screen name="VisitDetail" component={VisitDetailStub} options={{ title: 'Visit' }} />
      <Stack.Screen name="About" component={AboutScreen} />
      <Stack.Screen name="Home" component={HomeScreen} />
    </Stack.Navigator>
  ) : (
    <Stack.Navigator>
      <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

export default function App() {
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
