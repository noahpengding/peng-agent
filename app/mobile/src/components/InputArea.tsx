import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';

interface Props {
  onSend: (message: string) => void;
  isLoading: boolean;
}

export const InputArea: React.FC<Props> = ({ onSend, isLoading }) => {
  const [text, setText] = useState('');

  const handleSend = () => {
    if (text.trim() && !isLoading) {
      onSend(text);
      setText('');
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="Type a message..."
        multiline
        placeholderTextColor="#9ca3af"
      />
      <TouchableOpacity
        style={[styles.sendButton, (!text.trim() || isLoading) && styles.disabledButton]}
        onPress={handleSend}
        disabled={!text.trim() || isLoading}
      >
        {isLoading ? (
            <ActivityIndicator color="white" size="small" />
        ) : (
            <Text style={styles.sendButtonText}>Send</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: 'white',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
    fontSize: 16,
    color: '#1f2937',
  },
  sendButton: {
    backgroundColor: '#4f46e5',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#9ca3af',
  },
  sendButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});
