import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Message } from './ChatInterface.types';
import { MessageItem } from './MessageItem';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
}

export const MessageList: React.FC<MessageListProps> = ({ messages, isLoading }) => {
  const [foldedMessages, setFoldedMessages] = useState<Record<string, boolean>>({});
  const messageRefs = useRef<Record<number, HTMLDivElement | null>>({});

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
      const isLongMessage =
        lastMessage.type === 'tool_calls' || lastMessage.type === 'tool_output' || lastMessage.type === 'reasoning_summary';

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
          <MessageItem
            key={message.messageId || index}
            message={message}
            index={index}
            isFolded={isFolded}
            onToggleFold={toggleFolded}
            setRef={setRef}
          />
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
};
