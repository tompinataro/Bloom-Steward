import React from 'react';
import { Text, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from './src/auth';
import { colors } from './src/theme';

import HomeScreen from './src/screens/HomeScreen';
import AboutScreen from './src/screens/AboutScreen';
import LoginScreen from './src/screens/LoginScreen';
import RouteListScreen from './src/screens/RouteListScreen';
import VisitDetailScreen from './src/screens/VisitDetailScreen';
import SignOutButton from './src/components/SignOutButton';
import AppSplash from './src/components/AppSplash';

export type RootStackParamList = {
  Login: undefined;
  RouteList: { saved?: boolean; savedOffline?: boolean } | undefined;
  VisitDetail: { id: number };
  Home: undefined;
  About: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function RootNavigator() {
  const { token, loading } = useAuth();
  // Simple splash while restoring token
  if (loading) {
    return <AppSplash />;
  }
  return token ? (
    <Stack.Navigator screenOptions={{ headerTitleAlign: 'center', headerTitleStyle: { fontWeight: '700' } }}>
      <Stack.Screen name="RouteList" component={RouteListScreen} options={{ title: 'Today\'s Route', headerRight: () => <SignOutButton /> }} />
      <Stack.Screen
        name="VisitDetail"
        component={VisitDetailScreen}
        options={({ navigation }) => ({
          title: 'Visit',
          headerLeft: () => (
            <Pressable onPress={() => navigation.goBack()} style={{ paddingHorizontal: 12, paddingVertical: 8 }} accessibilityRole="button" accessibilityLabel="Go back">
              <Text style={{ fontSize: 18 }}>{'< < <'}</Text>
            </Pressable>
          ),
        })}
      />
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
