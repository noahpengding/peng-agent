import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider } from 'react-redux';
import { store } from '@share/store'; // Shared store
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import * as SecureStore from 'expo-secure-store';
import TabNavigator from './src/navigation/TabNavigator';
import LoginScreen from './src/screens/LoginScreen';
import { setStorageAdapter } from '@share/utils/storage';
import { setToken } from '@share/store/slices/authSlice';
import { RootState } from '@share/store';
import { getApiUrl } from './src/utils/apiUtils';

const Stack = createNativeStackNavigator();

setStorageAdapter({
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
});

const AppNavigator = () => {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    (globalThis as { __PENG_API_BASE_URL__?: string }).__PENG_API_BASE_URL__ = getApiUrl();
  }, []);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const token = await SecureStore.getItemAsync('access_token');
      if (!mounted) return;
      dispatch(setToken(token));
      setHydrated(true);
    })();

    return () => {
      mounted = false;
    };
  }, [dispatch]);

  if (!hydrated) {
    return null;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="Home" component={TabNavigator} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <Provider store={store}>
        <AppNavigator />
      </Provider>
    </SafeAreaProvider>
  );
}