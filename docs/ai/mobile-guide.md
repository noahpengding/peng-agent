# Mobile Frontend Guide (/app/mobile)

## 1. Mobile App Summary
The mobile frontend is a cross-platform React Native application built with Expo. It provides core functionalities of the Peng Agent platform (Chat, Memory, Profile) utilizing native device capabilities like the camera and local file system.

## 2. Framework/Language/Runtime
- **Framework**: Expo 55, React Native 0.83
- **Language**: TypeScript
- **Runtime**: Bun (for package management and script running)

## 3. Entry Points
- `index.ts`: The registered root component which mounts `App.tsx`.
- `App.tsx`: Initializes the global Redux store, SecureStore adapters, reads the cached token for hydration, and mounts the React Navigation container.

## 4. Navigation Structure
- Uses **React Navigation v7** (`@react-navigation/native-stack` & `bottom-tabs`).
- `App.tsx` controls the top-level Auth guard:
  - If unauthenticated: shows `LoginScreen`.
  - If authenticated: shows `TabNavigator` (Home, Profile, etc.).

## 5. Screen/Component Organization
- **Screens**: Full-screen views live in `src/screens/` (e.g., `ChatScreen.tsx`, `LoginScreen.tsx`, `ProfileScreen.tsx`).
- **Components**: Reusable UI blocks live in `src/components/`.
- **Navigation**: Tab configuration lives in `src/navigation/TabNavigator.tsx`.

## 6. State Management
- Global state uses **Redux Toolkit** (`src/store/index.ts`).
- Interestingly, the Redux slices and service structures closely mirror the Web frontend, meaning state logic is heavily duplicated rather than shared via an overarching package.

## 7. API/Data-Fetching Pattern
- The API URL is injected via Expo Config (`app.config.js`) and retrieved in `src/utils/apiUtils.ts`.
- `src/utils/apiCall.ts` handles generic Axios requests, similar to the Web implementation. It automatically injects the Bearer token.
- Raw endpoints are abstracted inside `src/services/`.
- The chat send thunk resolves the current public egress IP through `src/utils/ipAddress.ts` for every send and includes it as `config.ip_address`; lookup failures fall back to an empty string.

## 8. Auth/Session Flow
1. App launches -> `App.tsx` checks `expo-secure-store` for `access_token`.
2. If token exists, Redux state is hydrated, bypassing login.
3. If no token, user enters credentials on `LoginScreen`.
4. `apiCall` is invoked; the backend returns a JWT, which is saved natively to `expo-secure-store`.

## 9. Local Storage/Persistence
- **Storage**: Uses `expo-secure-store` for cryptographic, on-device storage of the JWT `access_token`.
- Wrapped elegantly in `src/utils/storage.ts` to provide an identical interface to the Web `localStorage`.

## 10. Android Config and Permissions
- Controlled entirely via `app.config.js`.
- **Package**: `com.noahpengding.pengagent`
- **Permissions**: `CAMERA`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`.

## 11. Native Integrations
The app uses several Expo plugins for native device capabilities:
- `expo-camera`: Camera access.
- `expo-image-picker`: Gallery access.
- `expo-document-picker`: File picking.
- `expo-file-system`: Reading/writing device files.

## 12. Styling/Theme System
- Uses standard React Native `StyleSheet.create({})`.
- Centralized design tokens are stored in `src/utils/colors.ts` and `src/utils/typography.ts`, ensuring consistency with the "Technical & Moody" brand.

### Chat Markdown and Formula Rendering
- `ChatScreen.tsx` parses chat Markdown with `markdown-it` plus `markdown-it-katex`. It supports inline `$...$` and block `$$...$$` formulas.
- `src/utils/markdownMath.ts` adds the common LLM delimiter forms `\(...\)` and `\[...\]` without preprocessing code fences or ordinary message text.
- Block formulas render through `src/components/MarkdownMathBlock.tsx`. The KaTeX WebView must remain full-width because a height-only WebView can collapse inside a centered React Native container and leave a blank formula area.
- The block renderer measures its HTML content, caps its height relative to the device screen, and keeps overflow scrollable. Long formulas scroll horizontally instead of widening the chat bubble or shrinking to unreadable text.

## 13. Build Variants/Flavors
- Managed via Expo Application Services (EAS).
- Defined in `eas.json` (Profiles for dev, preview, production) and configured with a specific `projectId` in `app.config.js`.

## 14. Environment/Config
- `app.config.js` reads `process.env.API_URL` during build time and embeds it into the app bundle under `expo.extra.apiUrl`.

## 15. Commands
- **Install**: `bun install`
- **Start Metro Bundler**: `bun run start`
- **Run Android**: `bun run android`
- **Run iOS**: `bun run ios`

## 16. Testing Strategy
- Like the Web frontend, there is **no testing framework** (e.g., Jest, Detox) currently installed or configured in `package.json`. Mobile tests are entirely absent.

## 17. Mobile Development Workflow
1. Use `bun` to manage dependencies.
2. Develop screens in `src/screens/`.
3. Use `StyleSheet` referencing `colors.ts`.
4. Utilize `expo-` SDK tools for native integrations rather than ejecting.
5. Manage builds via `eas build`.

## 18. Files Future Agents Should Read First
1. `app/mobile/app.config.js`
2. `app/mobile/App.tsx`
3. `app/mobile/package.json`

## 19. Completed-Turn Retry
- The latest successfully completed assistant output shows a refresh-style retry control immediately before its feedback controls.
- `chatSlice.ts` keeps a cloned snapshot of the completed `POST /chat` request, including the message, attachments, knowledge base, model/operator, tools, short-term memory IDs, and resolved IP address.
- Retrying removes only the final user turn and its streamed assistant/tool/reasoning rows, restores the original request's pre-turn short-term memory IDs, re-adds the user row, and sends the saved request again.
- Configuration changes made after the original response do not affect its retry. Loading a different saved-memory transcript clears retry eligibility.

## Screen / Responsibility Table
| Screen/Flow | File paths | Responsibility | API/data used |
|---|---|---|---|
| `Login` | `src/screens/LoginScreen.tsx` | User authentication | `POST /api/login` |
| `Chat` | `src/screens/ChatScreen.tsx` | Core AI conversation | `chatService.ts` |
| `Profile` | `src/screens/ProfileScreen.tsx` | User preferences and settings | `userService.ts` |

## Memory Selection Notes
- `MemoryModal.tsx` loads memories from `POST /memory` one server-side page at a time. The API returns 20 memories per page plus page metadata.
- Selections are stored by memory ID outside the current page list so users can select memories across several pages and load them together into chat.
