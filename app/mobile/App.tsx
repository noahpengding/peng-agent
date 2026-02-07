import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { LoginScreen } from './src/screens/LoginScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { MemoryScreen } from './src/screens/MemoryScreen';
import { RAGScreen } from './src/screens/RAGScreen';
import { ModelScreen } from './src/screens/ModelScreen';
import { ActivityIndicator, View } from 'react-native';

/**
 * Main Application Entry Point
 *
 * In React Native, navigation is usually handled by libraries like React Navigation.
 * We use two types of navigators here:
 * 1. StackNavigator: Handles the flow between Login and Main screens.
 * 2. TabNavigator: Handles switching between different features (Chat, Memory, etc.) once logged in.
 */

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const MainTabs = () => {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Chat" component={ChatScreen} />
      <Tab.Screen name="Memory" component={MemoryScreen} />
      <Tab.Screen name="RAG" component={RAGScreen} />
      <Tab.Screen name="Model" component={ModelScreen} />
    </Tab.Navigator>
  );
};

const AppNavigator = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // The Stack Navigator manages the high-level application state (Auth flow)
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <Stack.Screen name="Main" component={MainTabs} />
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
};

export default function App() {
  return (
    // NavigationContainer must wrap the entire navigation structure
    <AuthProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
