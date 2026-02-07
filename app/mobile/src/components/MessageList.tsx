import React, { useRef, useEffect } from 'react';
import { FlatList, View, Text, StyleSheet } from 'react-native';
import { Message } from '@shared/types';
import Markdown from 'react-native-markdown-display';

interface Props {
  messages: Message[];
}

export const MessageList: React.FC<Props> = ({ messages }) => {
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    // Scroll to end when messages change
    if (messages.length > 0) {
        // Use a small timeout to allow layout to calculate
        setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
    }
  }, [messages]);

  const renderItem = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[
        styles.messageWrapper,
        isUser ? styles.userWrapper : styles.botWrapper
      ]}>
        <View style={[
          styles.messageContainer,
          isUser ? styles.userMessage : styles.botMessage
        ]}>
            <Text style={[styles.roleText, isUser && styles.userRoleText]}>{isUser ? 'You' : 'Assistant'}</Text>
            {isUser ? (
                <Text style={styles.userText}>{item.content}</Text>
            ) : (
                <Markdown style={markdownStyles}>
                    {item.content}
                </Markdown>
            )}
        </View>
      </View>
    );
  };

  return (
    <FlatList
      ref={flatListRef}
      data={messages}
      keyExtractor={(item, index) => item.messageId || index.toString()}
      renderItem={renderItem}
      contentContainerStyle={styles.listContent}
    />
  );
};

const styles = StyleSheet.create({
  listContent: {
    padding: 10,
    paddingBottom: 20,
  },
  messageWrapper: {
    marginBottom: 10,
    flexDirection: 'row',
  },
  userWrapper: {
    justifyContent: 'flex-end',
  },
  botWrapper: {
    justifyContent: 'flex-start',
  },
  messageContainer: {
    maxWidth: '85%',
    padding: 10,
    borderRadius: 10,
  },
  userMessage: {
    backgroundColor: '#4f46e5', // indigo-600
  },
  botMessage: {
    backgroundColor: '#f3f4f6', // gray-100
  },
  roleText: {
    fontSize: 10,
    marginBottom: 4,
    opacity: 0.7,
    color: '#6b7280',
  },
  userRoleText: {
    color: 'rgba(255,255,255,0.8)',
  },
  userText: {
      color: 'white',
      fontSize: 16,
  }
});

const markdownStyles = {
  body: {
    color: '#1f2937', // gray-800
    fontSize: 16,
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 10,
  },
};
