## 2025-06-03 - Chat Interface Accessibility
**Learning:** Icon-only buttons (like send/upload) in chat interfaces often lack accessible names, making them invisible to screen readers.
**Action:** Always check `aria-label` for buttons that rely on icons or emojis for visual meaning.

## 2025-06-03 - Code Highlighting Robustness
**Learning:** Regex `\w+` for language detection fails for languages with special characters like C++ or C#.
**Action:** Use robust parsing (e.g., `split(' ')`) to ensure correct language identification in syntax highlighters.

## 2026-03-21 - Error Message Accessibility
**Learning:** Error messages that appear dynamically (like after a failed login or failed API call) are often missed by screen readers unless they are focused or have an ARIA alert role.
**Action:** Always add `role="alert"` and `aria-live="assertive"` to error message containers so they are immediately announced when they appear in the DOM.

## 2025-02-23 - Async Action Accessibility
**Learning:** Form submit buttons without explicit loading state fail to communicate that background processing is happening, especially problematic for screen readers.
**Action:** Always provide a clear loading state (e.g. SVG spinner) and update the `aria-label` (e.g. "Sending message...") to ensure feedback for interactive processes.

## 2026-05-09 - Disabled State Tooltips and Menu Accessibility
**Learning:** Disabled buttons without clear tooltips confuse users. Dynamic `title` attributes based on the exact reason for the disabled state provide much better UX. Also, custom menus require `aria-expanded`, `aria-haspopup`, and `role="menuitem"` to be fully accessible to screen readers.
**Action:** Always provide dynamic `title` and `aria-label` for buttons that can be disabled for multiple reasons. Always use correct ARIA roles and states for custom dropdown menus.
