import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@share/store';
import { sendMessage, setInput } from '@share/store/slices/chatSlice';
import Markdown from 'react-native-markdown-display';

export default function ChatScreen() {
  const dispatch = useDispatch();
  const messages = useSelector((state: RootState) => state.chat.messages);
  const input = useSelector((state: RootState) => state.chat.input);
  const status = useSelector((state: RootState) => state.chat.status);

  const flatListRef = useRef<FlatList>(null);
  const [isMemoryVisible, setIsMemoryVisible] = useState(false);

  const handleSend = () => {
    if (input.trim() === '') return;
    dispatch(sendMessage({ message: input }) as any);
  };

  const renderMessage = ({ item }: { item: any }) => (
    <View style={[
      styles.messageWrapper,
      item.role === 'human' ? styles.messageWrapperUser : styles.messageWrapperAssistant
    ]}>
      <View style={[
        styles.messageBubble,
        item.role === 'human' ? styles.messageBubbleUser : styles.messageBubbleAssistant
      ]}>
        {item.role === 'ai' ? (
          <Markdown style={markdownStyles}>
            {item.content}
          </Markdown>
        ) : (
          <Text style={styles.userText}>{item.content}</Text>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chat</Text>
        <TouchableOpacity
          style={styles.memoryButton}
          onPress={() => setIsMemoryVisible(!isMemoryVisible)}
        >
          <Text style={styles.memoryButtonText}>🧠 Memory</Text>
        </TouchableOpacity>
      </View>

      {isMemoryVisible && (
        <View style={styles.memoryOverlay}>
          <Text style={styles.memoryTitle}>Memory Page</Text>
          {/* Memory Component content would go here */}
          <Text>Long term context from memory goes here...</Text>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(_, index) => index.toString()}
        renderItem={renderMessage}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inputContainer}
      >
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          value={input}
          onChangeText={(text) => dispatch(setInput(text))}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, !input.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={status === 'loading' || !input.trim()}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    height: 50,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingHorizontal: 15,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  memoryButton: {
    position: 'absolute',
    right: 15,
    padding: 8,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
  },
  memoryButtonText: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: '600',
  },
  memoryOverlay: {
    position: 'absolute',
    top: 55, // just below header
    right: 10,
    width: 250,
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 10,
  },
  memoryTitle: {
    fontWeight: 'bold',
    marginBottom: 10,
  },
  listContent: {
    padding: 15,
  },
  messageWrapper: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  messageWrapperUser: {
    justifyContent: 'flex-end',
  },
  messageWrapperAssistant: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  messageBubbleUser: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  messageBubbleAssistant: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  userText: {
    color: '#ffffff',
    fontSize: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 10,
    maxHeight: 100,
    minHeight: 40,
    fontSize: 16,
  },
  sendButton: {
    marginLeft: 10,
    backgroundColor: '#007AFF',
    borderRadius: 20,
    height: 40,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2, // Align with input visually
  },
  sendButtonDisabled: {
    backgroundColor: '#b0c4de',
  },
  sendButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
});

const markdownStyles = {
  body: {
    color: '#333333',
    fontSize: 16,
  },
  code_inline: {
    backgroundColor: '#f0f0f0',
    padding: 2,
    borderRadius: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  fence: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
};