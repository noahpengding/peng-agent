import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import TabNavigator from './src/navigation/TabNavigator';
import { Provider } from 'react-redux';
import { store } from '@share/store'; // Shared store
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function App() {
  return (
    <SafeAreaProvider>
      <Provider store={store}>
        <NavigationContainer>
          <TabNavigator />
        </NavigationContainer>
      </Provider>
    </SafeAreaProvider>
  );
}