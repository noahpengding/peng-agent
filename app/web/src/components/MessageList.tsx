import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Message } from '@/types/ChatInterface.types';
import { MessageItem } from './MessageItem';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  retryMessageId: string | null;
  onRetry: () => void;
  onSubmitFeedback: (messageId: string, chatId: number, feedback: 'upvote' | 'downvote' | 'no_response') => void;
}

// ⚡ Bolt Optimization: Wrapped the component in React.memo to prevent unnecessary re-renders.
// This avoids mapping over potentially hundreds of messages on every keystroke in the ChatInterface input field.
export const MessageList: React.FC<MessageListProps> = React.memo(({ messages, isLoading, retryMessageId, onRetry, onSubmitFeedback }) => {
  const [foldedMessages, setFoldedMessages] = useState<Record<string, boolean>>({});
  const messageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const retryMessageIndex = useMemo(() => {
    if (isLoading || !retryMessageId) {
      return -1;
    }

    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message.type === 'output_text' && message.chatId && message.messageId === retryMessageId) {
        return i;
      }
    }

    return -1;
  }, [isLoading, messages, retryMessageId]);

  const toggleFolded = useCallback((index: number, currentState: boolean) => {
    setFoldedMessages((prev) => ({
      ...prev,
      [index]: !currentState,
    }));
  }, []);

  const setRef = useCallback((el: HTMLDivElement | null, index: number) => {
    messageRefs.current[index] = el;
  }, []);

  // Auto-scroll logic for streaming long messages
  useEffect(() => {
    const lastMessageIndex = messages.length - 1;
    if (lastMessageIndex >= 0) {
      const lastMessage = messages[lastMessageIndex];
      const isLongMessage = lastMessage.type === 'tool_calls' || lastMessage.type === 'tool_output' || lastMessage.type === 'reasoning_summary';

      const isFolded = foldedMessages[lastMessageIndex] ?? lastMessage.folded ?? false;

      if (isLongMessage && !isFolded) {
        const el = messageRefs.current[lastMessageIndex];
        if (el) {
          el.scrollTop = el.scrollHeight;
        }
      }
    }
  }, [messages, foldedMessages]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="empty-chat">
        <p>Start a conversation by typing a message below.</p>
      </div>
    );
  }

  return (
    <div className="messages-list">
      {messages.map((message, index) => {
        const isFolded = foldedMessages[index] ?? message.folded ?? false;

        return (
          <div key={message.clientKey || message.messageId || `msg-${index}`}>
            <MessageItem
              message={message}
              index={index}
              isFolded={isFolded}
              onToggleFold={toggleFolded}
              setRef={setRef}
              canRetry={index === retryMessageIndex}
              onRetry={onRetry}
              onSubmitFeedback={onSubmitFeedback}
            />
          </div>
        );
      })}
      {isLoading && (
        <div className="message assistant-message">
          <div className="thinking-indicator">
            <span>●</span>
            <span>●</span>
            <span>●</span>
          </div>
        </div>
      )}
    </div>
  );
});

MessageList.displayName = 'MessageList';
