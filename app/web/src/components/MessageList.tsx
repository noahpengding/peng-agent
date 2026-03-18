import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Message } from '@/types/ChatInterface.types';
import { MessageItem } from './MessageItem';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  onSubmitFeedback: (messageId: string, chatId: number, feedback: 'upvote' | 'downvote' | 'no_response') => void;
}

// ⚡ Bolt Optimization: Wrapped the component in React.memo to prevent unnecessary re-renders.
// This avoids mapping over potentially hundreds of messages on every keystroke in the ChatInterface input field.
export const MessageList: React.FC<MessageListProps> = React.memo(({ messages, isLoading, onSubmitFeedback }) => {
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
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="empty-chat"
      >
        <p>Start a conversation by typing a message below.</p>
      </motion.div>
    );
  }

  return (
    <div className="messages-list">
      <AnimatePresence mode="popLayout" initial={false}>
        {messages.map((message, index) => {
          const isFolded = foldedMessages[index] ?? message.folded ?? false;

          return (
            <motion.div
              key={message.messageId || `msg-${index}`}
              layout
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{
                type: 'spring',
                stiffness: 400,
                damping: 30,
                mass: 0.8,
              }}
            >
              <MessageItem
                message={message}
                index={index}
                isFolded={isFolded}
                onToggleFold={toggleFolded}
                setRef={setRef}
                onSubmitFeedback={onSubmitFeedback}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="message assistant-message"
        >
          <div className="thinking-indicator">
            <motion.span
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ repeat: Infinity, duration: 1.4, times: [0, 0.5, 1] }}
            >●</motion.span>
            <motion.span
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ repeat: Infinity, duration: 1.4, times: [0, 0.5, 1], delay: 0.2 }}
            >●</motion.span>
            <motion.span
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ repeat: Infinity, duration: 1.4, times: [0, 0.5, 1], delay: 0.4 }}
            >●</motion.span>
          </div>
        </motion.div>
      )}
    </div>
  );
});

MessageList.displayName = 'MessageList';
