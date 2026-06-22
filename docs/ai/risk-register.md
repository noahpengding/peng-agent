# Risk Register

## Known Issues
Placeholder for technical debt and tricky parts of the codebase.

## Constraints
- **Database String Truncation**: To prevent MySQL errors, human input is truncated to 4,096 characters, and AI responses/reasoning blocks are truncated to 10,240 characters upon database insertion. This causes silent data loss for long AI outputs (like large code snippets).

## Risky Legacy Areas
- **Chat Streaming Performance:** The chat streaming Redux slice is performance-sensitive. History shows that incorrect array manipulation (e.g., using `.map()` on large message arrays during streaming) can cause UI blocking $O(n)$ allocations. Always use Immer's mutable drafts.
- **RAG & Memory Stability:** Multiple historical patches (`V2.3.5`, `V2.3.6`) suggest the RAG integration and short/long-term memory state management have historically been fragile.
- **Synchronous DB Calls in Async FastAPI Routes:** The backend uses a synchronous SQLAlchemy engine (`create_engine`) but exposes asynchronous FastAPI endpoints (`async def`). Performing blocking synchronous database transactions inside an `async def` function will block the main ASGI event loop, creating severe latency spikes under concurrent load.
- **Web Component Bloat:** Some frontend components like `ChatInterface.tsx` are very large (>600 lines) and mix layout, logic, styling, and networking. The mobile `ChatScreen.tsx` is >1100 lines. This monolithic, tightly coupled architecture is extremely risky to refactor without breaking unrelated behaviors.
- **Re-render Thrashing:** Because components are monolithic, they rely heavily on React's `useCallback` and `useMemo` (the "Bolt Optimization") to prevent expensive child trees from re-rendering on every keystroke. Removing these memoizations will degrade input latency immediately.

## Incomplete Migrations
- The frontend UI redesign ("Technical & Moody") was recent (`v2.4.2`). Be aware of potential trailing legacy CSS or inconsistent theming.

## Documented Warnings
- **Error Accessibility:** Ensure all dynamic error messages (Login, Chat, Profile) use `role="alert"` and `aria-live="assertive"`. A past commit explicitly fixed this omission to support screen readers.
- **Testing Budget:** The backend has a strict minimum test coverage budget of 50%, enforced by Datadog coverage uploads in CI.
- **Missing Web/Mobile Tests (Severe Risk):** There is absolute zero test coverage (no Jest, Vitest, Cypress, Detox) for the Web and Mobile frontends. The CI pipelines only enforce `eslint`. This heavily increases regression risk during frontend state refactors or component updates.
- **Frontend Code Duplication:** The Redux slices and API service definitions (`src/store/slices` and `src/services`) are heavily duplicated between `/app/web` and `/app/mobile`. Changes to state logic or API contracts MUST be implemented in both directories manually to prevent desynchronization.
- **API Mismatch Risk:** There is no OpenAPI/Swagger code generation linking the FastAPI backend to the TypeScript frontends. Payloads are manually typed twice (e.g., `ChatRequest` in Python vs `ChatRequest` in TS). Changing a backend Pydantic model can silently break frontends at runtime.

## Conflicting Docs/Code Behavior
- The `README.md` dictates the existence of an `app/share/` package for shared web/mobile state, but the directory is missing in the repository structure, manifesting as the duplicated code issue noted above.
