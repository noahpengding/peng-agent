## 2024-05-19 - BOLT - Frontend Performance Optimization
**Learning:** In `app/web/src/store/slices/chatSlice.ts`, the `handleChunk` reducer is called for every streaming chunk of an AI response (which can be hundreds of times per message).
Currently, it uses `state.messages.map()` over the entire message history to update `folded` states and `state.messages.map()` inside `finishMessage` and `attachChatIdToMessage`.
Since Redux Toolkit uses Immer under the hood, we can directly mutate `state.messages` to avoid iterating over the entire array for every single chunk. This changes an $O(n)$ operation on every chunk to an $O(k)$ (where $k$ is small, since we can just search from the end of the array, or iterate backwards, or use `findLastIndex` / `forEach` only changing specific items) or $O(1)$ by keeping track of the current message index.
Since the array is just mutated, Immer will handle the structural sharing optimally, reducing garbage collection pressure and main thread blocking during fast streaming.
We can use a simple backward loop `for (let i = state.messages.length - 1; i >= 0; i--)` to find the messages matching `messageId` and modify them directly, breaking early if we know we've processed all messages for this turn. (Or since we just want to update all for `messageId`, a backward loop is fast enough).

**Action:** Replace `state.messages = state.messages.map(...)` with a backwards iteration that mutates the elements directly in `handleChunk`, `finishMessage`, `attachChatIdToMessage` and `submitMessageFeedback` extraReducers.

## 2024-05-20 - BOLT - Frontend Performance Optimization
**Learning:** When using `react-markdown` to render streaming responses, `react-syntax-highlighter` inside a custom `CodeBlock` component can cause severe UI lag. The library is heavy, and by default, React re-renders all code blocks in the message whenever a new chunk arrives, even if their content hasn't changed.
We can avoid this by memoizing the custom `CodeBlock` component using `React.memo` with a custom equality check that compares `className`, `inline`, and the stringified `children`. This prevents re-rendering older, unmodified code blocks when new text is appended elsewhere in the stream.

**Action:** Wrap expensive markdown components (like `CodeBlock`) in `React.memo` with a custom equality check (`prevProps.className === nextProps.className && prevProps.inline === nextProps.inline && String(prevProps.children) === String(nextProps.children)`) when dealing with streaming chunk updates.