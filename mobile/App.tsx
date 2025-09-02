import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from './src/auth';

import HomeScreen from './src/screens/HomeScreen';
import AboutScreen from './src/screens/AboutScreen';
import LoginScreen from './src/screens/LoginScreen';
import RouteListScreen from './src/screens/RouteListScreen';
import VisitDetailScreen from './src/screens/VisitDetailScreen';
import SignOutButton from './src/components/SignOutButton';

export type RootStackParamList = {
  Login: undefined;
  RouteList: { saved?: boolean } | undefined;
  VisitDetail: { id: number };
  Home: undefined;
  About: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function RootNavigator() {
  const { token, loading } = useAuth();
  // Simple splash while restoring token
  if (loading) {
    return (
      <NavigationContainer>
        <StatusBar style="auto" />
      </NavigationContainer>
    );
  }
  return token ? (
    <Stack.Navigator>
      <Stack.Screen name="RouteList" component={RouteListScreen} options={{ title: 'Today\'s Route', headerRight: () => <SignOutButton /> }} />
      <Stack.Screen name="VisitDetail" component={VisitDetailScreen} options={{ title: 'Visit' }} />
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
      <NavigationContainer>
        <StatusBar style="auto" />
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
