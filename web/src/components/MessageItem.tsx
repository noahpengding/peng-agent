import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import 'katex/dist/katex.min.css';
import { Message } from './ChatInterface.types';

interface CodeBlockProps extends React.HTMLAttributes<HTMLElement> {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

// CodeBlock component with copy functionality
const CodeBlock = ({ inline, className, children, ...rest }: CodeBlockProps) => {
  const [isCopied, setIsCopied] = useState(false);
  const cls = className || '';
  const langToken = cls.split(' ').find((c) => c.startsWith('language-'));
  const lang = !inline && langToken ? langToken.replace('language-', '') : undefined;

  const handleCopy = async () => {
    if (!children) return;
    try {
      await navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // Silently fail if clipboard access is denied
    }
  };

  if (inline || !lang) {
    return (
      <code className={className} {...rest}>
        {children}
      </code>
    );
  }

  return (
    <div className="relative group my-4">
      <button
        type="button"
        className="absolute top-2 right-2 p-1.5 rounded bg-gray-700 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
        onClick={handleCopy}
        aria-label={isCopied ? 'Copied to clipboard' : 'Copy code'}
        title={isCopied ? 'Copied!' : 'Copy code'}
      >
        {isCopied ? '✓' : '📋'}
      </button>
      <SyntaxHighlighter
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        style={vscDarkPlus as any}
        language={lang}
        PreTag="div"
        customStyle={{ margin: 0, borderRadius: '0.375rem' }}
        {...rest}
      >
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    </div>
  );
};

interface MessageItemProps {
  message: Message;
  index: number;
  isFolded: boolean;
  onToggleFold: (index: number, currentState: boolean) => void;
  setRef: (el: HTMLDivElement | null, index: number) => void;
  onSubmitFeedback: (messageId: string, chatId: number, feedback: 'upvote' | 'downvote' | 'no_response') => void;
}

export const MessageItem = React.memo(({ message, index, isFolded, onToggleFold, setRef, onSubmitFeedback }: MessageItemProps) => {
  const messageClass =
    message.role === 'user'
      ? 'user-message'
      : message.type === 'tool_calls' || message.type === 'tool_output'
        ? 'tool-message'
        : message.type === 'reasoning_summary'
          ? 'reasoning-message'
          : 'assistant-message';

  const isFoldable = message.type === 'tool_calls' || message.type === 'tool_output' || message.type === 'reasoning_summary';
  const canShowFeedback = message.type === 'output_text' && !!message.chatId && !!message.messageId;
  const isFeedbackLocked = message.feedback === 'upvote' || message.feedback === 'downvote';

  const handleFeedbackClick = (feedback: 'upvote' | 'downvote') => {
    if (!message.messageId || !message.chatId || message.feedbackUpdating || isFeedbackLocked) {
      return;
    }
    onSubmitFeedback(message.messageId, message.chatId, feedback);
  };

  return (
    <div
      className={`message ${messageClass} ${isFoldable && isFolded ? 'folded-clickable' : ''}`}
      ref={(el) => setRef(el, index)}
      onClick={() => {
        if (isFoldable && isFolded) {
          onToggleFold(index, isFolded);
        }
      }}
    >
      {/* For foldable messages (tool_calls, reasoning_summary), show a toggle */}
      {isFoldable && (
        <button
          type="button"
          className="tool-summary"
          onClick={(event) => {
            event.stopPropagation();
            onToggleFold(index, isFolded);
          }}
          aria-expanded={!isFolded}
          aria-label={isFolded ? `Expand ${message.type?.replace('_', ' ')}` : `Collapse ${message.type?.replace('_', ' ')}`}
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
                code: CodeBlock,
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
          {canShowFeedback && (
            <div className="message-feedback-actions">
              {isFeedbackLocked ? (
                <button
                  type="button"
                  className="feedback-button selected locked"
                  disabled
                  title={message.feedback === 'upvote' ? 'Upvoted' : 'Downvoted'}
                  aria-label={message.feedback === 'upvote' ? 'Upvoted response' : 'Downvoted response'}
                >
                  {message.feedback === 'upvote' ? '👍' : '👎'}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className={`feedback-button ${message.feedbackUpdating ? 'is-submitting' : ''}`}
                    onClick={() => handleFeedbackClick('upvote')}
                    disabled={message.feedbackUpdating}
                    title="Upvote"
                    aria-label="Upvote response"
                  >
                    👍
                  </button>
                  <button
                    type="button"
                    className={`feedback-button ${message.feedbackUpdating ? 'is-submitting' : ''}`}
                    onClick={() => handleFeedbackClick('downvote')}
                    disabled={message.feedbackUpdating}
                    title="Downvote"
                    aria-label="Downvote response"
                  >
                    👎
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
});

MessageItem.displayName = 'MessageItem';
