import React, { useState } from 'react';
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

  const toggleFolded = (index: number) => {
    setFoldedMessages((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

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
        const isFolded = message.folded || foldedMessages[index];
        const messageClass =
          message.role === 'user'
            ? 'user-message'
            : message.type === 'tool_calls'
              ? 'tool-message'
              : message.type === 'reasoning_summary'
                ? 'reasoning-message'
                : 'assistant-message';

        return (
          <div key={index} className={`message ${messageClass}`}>
            {/* For foldable messages (tool_calls, reasoning_summary), show a toggle */}
            {(message.type === 'tool_calls' || message.type === 'reasoning_summary') && (
              <div className="tool-summary" onClick={() => toggleFolded(index)} style={{ cursor: 'pointer', userSelect: 'none' }}>
                <span style={{ marginRight: '8px' }}>{isFolded ? '▶' : '▼'}</span>
                <strong>{message.type === 'tool_calls' ? 'Tool Execution' : 'Reasoning Process'}</strong>
              </div>
            )}

            {/* Show content unless folded */}
            {!isFolded && (
              <>
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
              </>
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
