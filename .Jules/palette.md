## 2025-06-03 - Chat Interface Accessibility
**Learning:** Icon-only buttons (like send/upload) in chat interfaces often lack accessible names, making them invisible to screen readers.
**Action:** Always check `aria-label` for buttons that rely on icons or emojis for visual meaning.

## 2025-06-03 - Code Highlighting Robustness
**Learning:** Regex `\w+` for language detection fails for languages with special characters like C++ or C#.
**Action:** Use robust parsing (e.g., `split(' ')`) to ensure correct language identification in syntax highlighters.
## 2026-03-21 - Error Message Accessibility\n**Learning:** Error messages that appear dynamically (like after a failed login or failed API call) are often missed by screen readers unless they are focused or have an ARIA alert role.\n**Action:** Always add `role="alert"` and `aria-live="assertive"` to error message containers so they are immediately announced when they appear in the DOM.

## 2023-10-27 - Keyboard Accessibility for Interactive Elements
**Learning:** Adding `tabIndex={-1}` to interactive elements like buttons (e.g., a "Show/Hide password" toggle) removes them from the document's tab order, making them inaccessible to keyboard-only and screen reader users.
**Action:** Ensure that native interactive elements (`<button>`, `<a>`, `<input>`) do not have `tabIndex={-1}` unless explicitly intended to be skipped and focus is managed programmatically elsewhere.
