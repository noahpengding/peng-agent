## 2024-05-23 - React.memo on MessageList
**Learning:** In chat applications using streaming responses (token-by-token updates), lack of memoization on individual message components causes the entire list to re-render on every token. This is exponentially expensive with complex renderers like ReactMarkdown + SyntaxHighlighter.
**Action:** Always memoize list items in append-only or streaming lists where only the last item changes frequently.
