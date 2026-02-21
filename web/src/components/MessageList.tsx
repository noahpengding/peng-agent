import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import 'katex/dist/katex.min.css';
import { Message } from './ChatInterface.types';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
}

export const MessageList: React.FC<MessageListProps> = ({ messages, isLoading }) => {
  const [foldedMessages, setFoldedMessages] = useState<Record<string, boolean>>({});
  const messageRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const toggleFolded = (index: number, currentState: boolean) => {
    setFoldedMessages((prev) => ({
      ...prev,
      [index]: !currentState,
    }));
  };

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
        const messageClass =
          message.role === 'user'
            ? 'user-message'
            : message.type === 'tool_calls' || message.type === 'tool_output'
              ? 'tool-message'
              : message.type === 'reasoning_summary'
                ? 'reasoning-message'
                : 'assistant-message';

        const isFoldable = message.type === 'tool_calls' || message.type === 'tool_output' || message.type === 'reasoning_summary';
        const toggleId = `toggle-${index}`;
        const contentId = `content-${index}`;

        return (
          <div
            key={index}
            className={`message ${messageClass} ${isFoldable && isFolded ? 'folded-clickable' : ''}`}
            ref={(el) => {
              messageRefs.current[index] = el;
            }}
            onClick={() => {
              if (isFoldable && isFolded) {
                toggleFolded(index, isFolded);
              }
            }}
          >
            {/* For foldable messages (tool_calls, reasoning_summary), show a toggle */}
            {isFoldable && (
              <button
                type="button"
                id={toggleId}
                aria-expanded={!isFolded}
                aria-controls={contentId}
                className="tool-summary"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleFolded(index, isFolded);
                }}
              >
                <span className="fold-arrow" aria-hidden="true">
                  {isFolded ? '⇨' : '⇩'}
                </span>
                <strong>
                  {message.type === 'tool_calls'
                    ? 'Tool Call'
                    : message.type === 'tool_output'
                      ? 'Tool Output'
                      : message.type === 'reasoning_summary'
                        ? 'Reasoning Summary'
                        : 'Message'}
                </strong>
              </button>
            )}

            {/* Show content unless folded */}
            {!isFolded && (
              <div
                id={isFoldable ? contentId : undefined}
                role={isFoldable ? 'region' : undefined}
                aria-labelledby={isFoldable ? toggleId : undefined}
              >
                {message.images && message.images.length > 0 && (
                  <div className="message-images-container">
                    {message.images.map((imgSrc, imgIndex) => (
                      <div key={imgIndex} className="message-image-container">
                        <img src={imgSrc} alt="Message attachment" className="message-image" />
                      </div>
                    ))}
                  </div>
                )}
                <div className="message-text markdown-content">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      p: ({ ...props }) => <p className="tight-paragraph" {...props} />,
                      li: ({ ...props }) => <li className="tight-list-item" {...props} />,
                      code: (props: { inline?: boolean; className?: string; children?: React.ReactNode }) => {
                        const { inline, className, children, ...rest } = props;
                        const cls = className || '';
                        const langToken = cls.split(' ').find((c) => c.startsWith('language-'));
                        const lang = !inline && langToken ? langToken.replace('language-', '') : undefined;
                        return !inline && lang ? (
                          <SyntaxHighlighter style={vscDarkPlus as Record<string, React.CSSProperties>} language={lang} PreTag="div" {...rest}>
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        ) : (
                          <code className={className} {...rest}>
                            {children}
                          </code>
                        );
                      },
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
              </div>
            )}
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
};
