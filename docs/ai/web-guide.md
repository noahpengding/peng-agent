# Web Frontend Guide (/app/web)

## 1. Web App Summary
The web frontend is a Single Page Application (SPA) providing the user interface for the Peng Agent chat system. It supports real-time text streaming, memory management, RAG (Retrieval-Augmented Generation) document uploads, and model configuration.

## 2. Framework/Runtime
- **Runtime**: Bun (Package manager and script runner)
- **Framework**: React 19
- **Build Tool**: Vite
- **Language**: TypeScript

## 3. Entry Points
- `src/index.tsx`: Sets up routing (`react-router-dom`), initializes Datadog Real User Monitoring (RUM), and mounts the React root.
- `src/App.tsx`: The root component that wraps the router outlet in the Redux `Provider`.

## 4. Routing Structure
Uses `react-router-dom` v6 `createBrowserRouter`.
- `/login`: Public login screen.
- `/*`: Protected routes wrapped by `<PrivateRoute />`.
- `/` or `/chat`: Main chat interface (`ChatInterface.tsx`).
- `/memory`: Session and long-term memory management (`MemorySelection.tsx`).
- `/rag`: Knowledge base upload and management (`RAGInterface.tsx`).
- `/model`: LLM operator and model selection (`ModelInterface.tsx`).

## 5. Page/Layout/Component Organization
The frontend uses a relatively flat structure inside `src/components/`, mixing full-page views and reusable components.
- **Views**: `ChatInterface.tsx`, `Login.tsx`, `MemorySelection.tsx`, `RAGInterface.tsx`, `ModelInterface.tsx`.
- **UI Components**: `MessageItem.tsx`, `MessageList.tsx`, `InputArea.tsx`, `ImageModal.tsx`.

## 6. State Management
Managed globally via **Redux Toolkit** (`src/store/index.ts`).
- `chatSlice.ts`: Handles message history, streaming state, and tool call states.
- `authSlice.ts`: Tracks authentication status and tokens.
- `modelSlice.ts`: Tracks available models and user preferences.
- `toolSlice.ts`: Tracks available tools for the agent.

## 7. API/Data-Fetching Pattern
All API calls pass through a centralized wrapper `apiCall` in `src/utils/apiUtils.ts`.
- Uses `axios`.
- Automatically attaches the `Authorization: Bearer <token>` header from `src/utils/storage.ts`.
- Handles `401 Unauthorized` globally by clearing the token and redirecting to `/login`.
- Services (`src/services/*.ts`) wrap specific endpoints to provide typings to Redux thunks or components.
- The chat send thunk resolves the current public egress IP through `src/utils/ipAddress.ts` for every send and includes it as `config.ip_address`; lookup failures fall back to an empty string.

## 8. Auth/Session Flow
1. User logs in via `/login`.
2. `apiCall` POSTs credentials.
3. The returned JWT token is saved via `utils/storage.ts`.
4. `PrivateRoute` checks Redux auth state / storage before allowing access to internal routes.

## 9. Forms/Validation
Forms use native React controlled components. No heavy form validation libraries (like react-hook-form or formik) are present in `package.json`.

## 10. Styling/Theme/Design System
- **CSS Framework**: TailwindCSS v4 (`@tailwindcss/postcss`).
- **Convention**: Mix of Tailwind utility classes and component-specific stylesheets (e.g., `ChatInterface.css`, `Login.css`). Follows the "Technical & Moody" design ethos.

## 11. Environment Variables
- Injected via Vite (`import.meta.env`) and a runtime fallback (`window.RUNTIME_CONFIG` from `public/config.js`).
- Key variables include `VITE_BACKEND_URL`, and various `VITE_DATADOG_*` telemetry keys.
- Dev defaults are loaded via `bun --env-file=../../test/front.env run vite`.

## 12. Commands
- **Install**: `bun install`
- **Dev Server**: `bun run dev` (starts on port 3000, proxies `/proxy` to the backend)
- **Build**: `bun run build`
- **Lint**: `bun run lint`

## 13. Testing Strategy
Currently, there is **no testing framework** (e.g., Vitest, Jest, Cypress) configured in `package.json`. The web testing strategy is absent.

## 14. Error/Loading Conventions
- **API Errors**: `apiUtils.ts` catches Axios errors and throws standard `Error(errorMessage)` based on backend payload, which is then handled by local component `try/catch` blocks and displayed in native DOM elements with `role="alert"`.

## 15. Reusable Components/Hooks/Utilities
- `src/utils/apiUtils.ts` (API wrapper)
- `src/utils/storage.ts` (Local storage wrapper)
- `src/components/InputArea.tsx` (Shared text input logic)

## 16. Web Development Workflow
1. Use `bun` for package management.
2. Build components in `src/components/`.
3. Wire state through `src/store/slices/`.
4. Add API definitions in `src/services/`.
5. Ensure styles adhere to Tailwind + custom CSS files.

## 17. Files Future Agents Should Read First
1. `app/web/package.json`
2. `app/web/src/index.tsx`
3. `app/web/src/utils/apiUtils.ts`
4. `app/web/src/store/index.ts`

## 18. Completed-Turn Retry
- The latest successfully completed assistant output shows a retry control immediately before its feedback controls.
- `chatSlice.ts` keeps a cloned snapshot of the completed `POST /chat` request, including the message, attachments, knowledge base, model/operator, tools, short-term memory IDs, and resolved IP address.
- Retrying removes only the final user turn and its streamed assistant/tool/reasoning rows, restores the original request's pre-turn short-term memory IDs, re-adds the user row, and sends the saved request again.
- Configuration changes made after the original response do not affect its retry. Loading a different saved-memory transcript clears retry eligibility.

## 19. Temporary Chat
- The Configuration sidebar contains an accessible temporary-chat switch. It is off by default and disabled while a request is streaming.
- The selected value is sent as `config.temp_chat` and is included in the completed-request snapshot.
- Temporary responses receive no persisted chat ID, are not appended to short-term memory, and do not expose persisted feedback or retry controls.

## Route / API Responsibility Table
| Route/Page | File paths | Responsibility | API/data used |
|---|---|---|---|
| `/login` | `src/components/Login.tsx` | User authentication | `POST /api/login` |
| `/chat` | `src/components/ChatInterface.tsx` | Main agent conversation | `chatService.ts` endpoints |
| `/memory` | `src/components/MemorySelection.tsx` | Managing short/long term context | `memoryService.ts` endpoints |
| `/rag` | `src/components/RAGInterface.tsx` | Uploading/managing knowledge bases | `ragService.ts`, `uploadService.ts` |
| `/model` | `src/components/ModelInterface.tsx` | Selecting provider/models | `modelService.ts` endpoints |

## Memory Selection Notes
- `MemorySelection.tsx` loads memories from `POST /memory` one server-side page at a time. The API returns 20 memories per page plus page metadata.
- Selections are stored by memory ID outside the current page list so users can select memories across several pages and load them together into chat.
