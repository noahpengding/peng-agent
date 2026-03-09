import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import ChatScreen from '../screens/ChatScreen';
import ModelModal from '../components/ModelModal';
import RAGModal from '../components/RAGModal';
import UserProfileModal from '../components/UserProfileModal';

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
  const [modelModalVisible, setModelModalVisible] = React.useState(false);
  const [userProfileVisible, setUserProfileVisible] = React.useState(false);

  return (
    <>
    <Tab.Navigator
      initialRouteName="Chat"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e0e0e0',
          height: 60,
        },
      }}
    >
      <Tab.Screen
        name="ModelsMemory"
        options={{
          tabBarIcon: ({ color, size }) => (
            <View style={styles.iconContainer}>
              <Text style={{ color, fontSize: size }} onPress={() => setModelModalVisible(true)}>M/M</Text>
            </View>
          ),
        }}
        listeners={{
          tabPress: e => {
            e.preventDefault();
            setModelModalVisible(true);
          },
        }}
      >
        {() => <View />}
      </Tab.Screen>

      <Tab.Screen
        name="Chat"
        options={{
          tabBarIcon: ({ color }) => (
            <View style={styles.centerIconContainer}>
              <Text style={{ color: 'white', fontSize: 24 }}>C</Text>
            </View>
          ),
        }}
        component={ChatScreen}
      />

      <Tab.Screen
        name="ToolsProfile"
        options={{
          tabBarIcon: ({ color, size }) => (
            <View style={styles.iconContainer}>
              <Text style={{ color, fontSize: size }}>T/P</Text>
            </View>
          ),
        }}
        listeners={{
          tabPress: e => {
            e.preventDefault();
            setUserProfileVisible(true);
          },
        }}
      >
        {() => <View />}
      </Tab.Screen>
    </Tab.Navigator>
    <ModelModal visible={modelModalVisible} onClose={() => setModelModalVisible(false)} />
    <UserProfileModal visible={userProfileVisible} onClose={() => setUserProfileVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF', // Theme color
    marginBottom: 20, // Push it up
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
});