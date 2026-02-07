import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const MemoryScreen = () => {
  return (
    <View style={styles.container}>
      <Text>Memory Management</Text>
      <Text>(Not implemented yet)</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
