# Development Conventions

## 1. Global Conventions
- **Package Management:** Use `uv` for Python (`server`) and `bun` for TypeScript/React (`app/web`, `app/mobile`). Never use `npm`, `yarn`, or `pip` directly.
- **Strict Typing:** Leverage Pydantic in Python and TypeScript interfaces in the frontends to define domain objects (e.g., `ChatRequest`, `Message`).
- **Feature Duplication:** Because there is no shared package across frontends, modifying a Redux slice or an API service hook requires duplicating the exact logic across both `/app/web` and `/app/mobile`.

## 2. Backend Conventions
- **Architecture:** Separation of concerns. Routes -> Handlers -> Services -> Utilities.
- **Dependency Injection:** Minimal DI framework. FastAPI `Depends` is used primarily for authentication token parsing.
- **Async Patterns:** FastAPI exposes `async def` endpoints, but historically the SQLAlchemy engine blocks synchronously. (See Risk Register).

## 3. Web Conventions
- **Component Design:** Components are large and monolithic (e.g., `ChatInterface.tsx`). They handle their own local state, Redux subscriptions, and DOM event listeners. 
- **Styling:** Vanilla CSS imported at the top of the file (`import './ChatInterface.css'`) rather than styled-components or pure Tailwind.
- **Performance Optimization:** Heavy reliance on `useCallback` and `useMemo` to prevent expensive re-renders during state mutations. (e.g., The "Bolt Optimization" pattern).

## 4. Mobile Conventions
- **Component Design:** React Native functional components wrapped with `SafeAreaView`. Very monolithic (e.g., `ChatScreen.tsx` is >1100 lines).
- **Styling:** Uses `StyleSheet.create({})`. Hardcodes design tokens imported from `../utils/colors` and `../utils/typography`.

## 5. Testing Conventions
- **Backend:** `unittest` with heavy `unittest.mock.patch` isolation.
- **Frontend:** No testing frameworks exist. Validate logic via TypeScript compiler (`tsc`) and `eslint`.

## 6. Error Handling Conventions
- **Backend:** Wrap handler logic in `try/except Exception as e:`. Log the error using `output_log(f"Error: {e}", "error")`, then raise an `HTTPException(status_code=500)` or return a safe default.
- **Frontend:** Wrap async actions in `try/catch`. On failure, extract the error message and dispatch to the global Redux error state (`dispatch(setError(err.message))`). Provide a visual fallback using `role="alert"`.

## 7. API/Data Conventions
- No automated OpenAPI code generation. TypeScript interfaces must be updated by hand whenever a Pydantic model changes.

## 8. Naming Conventions
- **Python:** `snake_case` for functions/variables (`chat_handler`), `PascalCase` for classes (`ChatConfig`).
- **React/TS:** `PascalCase` for component filenames (`ChatInterface.tsx`) and components. `camelCase` for hooks (`useRAGApi`) and local variables.
- **Redux Slices:** `camelCase` suffixed with Slice (`chatSlice.ts`).

## 9. File Organization Conventions
- Backend: `/server/api`, `/server/models`, `/server/handlers`, `/server/services`, `/server/utils`.
- Frontend: `/src/components`, `/src/screens`, `/src/store`, `/src/services`, `/src/hooks`, `/src/utils`.

## 10. Import/Export Conventions
- **Python:** Standard library -> Third party -> Local absolute imports (e.g. `from utils.log import output_log`).
- **TypeScript:** Heavily utilizes absolute path aliases starting with `@/` for project roots (e.g., `import { AppDispatch } from '@/store';`). 

## 11. Formatting/Linting Conventions
- Backend: `ruff` (enforced in CI).
- Frontend: `eslint` and `prettier` run via Bun (enforced in CI).

## 12. Patterns to Copy
- **Safe Async Cleanup:** Frontend `useEffect` hooks fetching data set a local `let mounted = true;` flag, and check `if (!mounted) return;` inside the `.then()` block to prevent state updates on unmounted components.
- **Centralized Logging:** The backend always uses `from utils.log import output_log` rather than native `print()`.

## 13. Patterns Not to Copy (Anti-patterns)
- **Monolithic Components:** Do not add hundreds of lines to `ChatInterface.tsx` or `ChatScreen.tsx`. Break new features into smaller sub-components.
- **Synchronous DB calls in Async Routes:** Do not perform blocking database operations in an `async def` backend route without pushing them to a threadpool.

## 14. Convention Map

| Convention | Area | Example files | Future agent instruction |
|---|---|---|---|
| Custom Logger | Backend | `server/utils/log.py` | Never use `print()`. Use `output_log(msg, level)`. |
| Async Cleanup | Frontend | `app/web/src/components/ChatInterface.tsx` | Use a `mounted` boolean flag in `useEffect` promises. |
| Redux Error State | Frontend | `app/mobile/src/screens/ChatScreen.tsx` | Catch errors and use `dispatch(setError(err.message))`. |
| Alias Imports | Frontend | `app/web/src/components/ChatInterface.tsx` | Use `@/store`, `@/hooks`, etc. instead of `../../../`. |
