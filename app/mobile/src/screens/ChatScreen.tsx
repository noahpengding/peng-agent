import React, { useState } from 'react';
import { View, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, Text, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { MessageList } from '../components/MessageList';
import { InputArea } from '../components/InputArea';
import { ChatService } from '../services/chatService';
import { Message, ChatRequest } from '@shared/types';
import { useNavigation } from '@react-navigation/native';

/**
 * Chat Screen
 *
 * Uses SafeAreaView to ensure content respects device notches and status bars.
 * Uses KeyboardAvoidingView to handle the keyboard covering the input area.
 */
export const ChatScreen = () => {
  const { user, logout } = useAuth();
  const navigation = useNavigation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Configuration - hardcoded for now or fetch from a config context/service
  const config = {
    operator: 'default',
    base_model: 'llama2', // Example
    tools_name: [],
    short_term_memory: [],
    long_term_memory: [],
  };

  const handleSend = async (text: string) => {
    const userMessage: Message = {
      role: 'user',
      content: text,
      messageId: Date.now().toString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    const botMessageId = (Date.now() + 1).toString();
    const botMessage: Message = {
        role: 'assistant',
        content: '',
        messageId: botMessageId,
        type: 'output_text'
    };

    // Add empty bot message
    setMessages((prev) => [...prev, botMessage]);

    const request: ChatRequest = {
      user_name: user || 'User',
      message: text,
      image: [],
      config,
    };

    let fullContent = '';

    await ChatService.sendMessage(
        request,
        (chunk, type, done) => {
            if (type === 'output_text') {
                fullContent += chunk;
                setMessages((prev) =>
                    prev.map((msg) =>
                        msg.messageId === botMessageId
                        ? { ...msg, content: fullContent }
                        : msg
                    )
                );
            }
        },
        () => {
            setIsLoading(false);
        },
        (error) => {
            setIsLoading(false);
            Alert.alert('Error', error.message);
        }
    );
  };

  const handleLogout = () => {
      logout();
  };

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={handleLogout} style={{marginRight: 10}}>
          <Text style={{color: '#ef4444'}}>Logout</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <MessageList messages={messages} />
        <InputArea onSend={handleSend} isLoading={isLoading} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  keyboardAvoid: {
      flex: 1,
  }
});
