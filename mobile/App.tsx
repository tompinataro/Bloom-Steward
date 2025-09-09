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

const Stack = createStackNavigator<RootStackParamList>();

function RootNavigator() {
  const { token, loading } = useAuth();
  // Simple splash while restoring token
  if (loading) {
    return <AppSplash />;
  }
  return token ? (
    <Stack.Navigator initialRouteName="RouteList" screenOptions={{ headerTitleAlign: 'center', headerTitleStyle: { fontWeight: '700' } }}>
      <Stack.Screen name="RouteList" component={RouteListScreen} options={{ title: 'Today\'s Route' }} />
      <Stack.Screen
        name="VisitDetail"
        component={VisitDetailScreen}
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
