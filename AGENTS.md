# Agent Operating Manual

Welcome to the Peng Agent repository. This document serves as the high-level operating manual and core reference for future AI coding agents. It outlines rules, key architectural invariants, and command lists. Before making any changes to the codebase, agents must read this document and the detailed guides in the documentation system.

---

## 1. Project Overview
The **Peng Agent** system is an agentic, monolithic AI conversation platform. It enables human users to interact with advanced Large Language Models (LLMs) via distinct **AI Operators** (e.g., OpenAI, Anthropic, Ollama) and **Models**. The system tracks detailed message contexts, internal AI thinking processes (reasoning), external tools called during execution, and semantic search (RAG) datasets, delivering a robust, technical-first developer chat interface.

---

## 2. Repository Map
*   **Backend:** `/server` — FastAPI web application (Python 3.12).
*   **Web Frontend:** `/app/web` — Single Page React Application (React 19 / Vite / TypeScript).
*   **Mobile Frontend:** `/app/mobile` — Cross-platform mobile client (React Native / Expo 55 / TypeScript).
*   **Documentation:** `/docs/ai` — Complete, detailed system documentation and developer guides.

---

## 3. Where to Read Detailed AI Documentation
For exhaustive context, design patterns, and in-depth walkthroughs, refer to the **AI Knowledge Base** entry point:
*   [docs/ai/README.md](file:///c:/Users/dingy/projects/peng-bot/peng-agent/docs/ai/README.md)

---

## 4. Backend Summary & Guide
*   **Tech Stack:** Python 3.12, FastAPI, SQLAlchemy, LangChain/LangGraph, Redis, MySQL, Qdrant, MinIO.
*   **Entry Point:** [server/main.py](file:///c:/Users/dingy/projects/peng-bot/peng-agent/server/main.py) (starts the Uvicorn application on port `8000`).
*   **Key CLI Commands:**
    *   Start Dev Server: `cd server && python main.py`
    *   Run Test Suite: `cd server && uv run python -m unittest discover -s test`
*   **Critical Constraint:** The backend utilizes a synchronous SQLAlchemy database engine. Performing database calls directly inside `async def` FastAPI routes will block the main ASGI event loop. Ensure all synchronous network or database operations are executed within a threadpool (e.g., using `run_in_threadpool`).
*   **Detailed Guide:** [docs/ai/backend-guide.md](file:///c:/Users/dingy/projects/peng-bot/peng-agent/docs/ai/backend-guide.md)

---

## 5. Web Summary & Guide
*   **Tech Stack:** React 19, Bun runtime, Vite, TypeScript, TailwindCSS v4, Redux Toolkit.
*   **Entry Points:** [app/web/src/index.tsx](file:///c:/Users/dingy/projects/peng-bot/peng-agent/app/web/src/index.tsx) and [app/web/src/App.tsx](file:///c:/Users/dingy/projects/peng-bot/peng-agent/app/web/src/App.tsx).
*   **Key CLI Commands:**
    *   Install Dependencies: `bun install`
    *   Start Dev Server: `bun run dev` (runs on port `3000`)
    *   Build Production Bundle: `bun run build`
    *   Run Linter: `bun run lint`
*   **Performance Invariant:** Large UI message lists are performance-critical during real-time streaming. You MUST strictly use React's `useMemo` and `useCallback` to prevent catastrophically expensive re-renders during typing or text streaming.
*   **Detailed Guide:** [docs/ai/web-guide.md](file:///c:/Users/dingy/projects/peng-bot/peng-agent/docs/ai/web-guide.md)

---

## 6. Mobile Summary & Guide
*   **Tech Stack:** React Native, Expo 55, Bun runtime, TypeScript, React Navigation v7, Redux Toolkit, expo-secure-store.
*   **Entry Points:** [app/mobile/index.ts](file:///c:/Users/dingy/projects/peng-bot/peng-agent/app/mobile/index.ts) and [app/mobile/App.tsx](file:///c:/Users/dingy/projects/peng-bot/peng-agent/app/mobile/App.tsx).
*   **Key CLI Commands:**
    *   Install Dependencies: `bun install`
    *   Start Bundler (Metro): `bun run start`
    *   Run Android Emulator: `bun run android`
    *   Run iOS Simulator: `bun run ios`
*   **Hardware Integrations:** Leverages native Expo modules for CAMERA, READ_EXTERNAL_STORAGE, and WRITE_EXTERNAL_STORAGE permissions.
*   **Detailed Guide:** [docs/ai/mobile-guide.md](file:///c:/Users/dingy/projects/peng-bot/peng-agent/docs/ai/mobile-guide.md)

---

## 7. API Contract Warning
*   **Manual Synchronization Warning:** The repository does **NOT** use automated OpenAPI generators or tRPC/gRPC. All TypeScript interfaces in the frontends are written **manually** to mirror Python Pydantic models.
*   **Critical Duty:** If you change a backend Pydantic model in `/server/models/`, you MUST search for and manually update the corresponding TypeScript interfaces in:
    *   `app/web/src/services/`
    *   `app/mobile/src/services/`
*   **Detailed Guide:** [docs/ai/api-contracts.md](file:///c:/Users/dingy/projects/peng-bot/peng-agent/docs/ai/api-contracts.md)

---

## 8. Domain Invariant Warning
Keep these strict business rules intact at all times:
*   **String Truncation Limits:** To prevent MySQL overflow crashes on standard `TEXT` fields:
    *   `human_input` is strictly truncated to **`4096`** characters.
    *   `AIResponse`, `AIReasoning` (thought blocks), and `ToolOutput` are strictly truncated to **`10240`** characters before database insertion.
*   **Binary Data Skipping:** The chat handler streaming parser will **skip** saving any `ToolOutput` to the database if it detects binary bytes (`bytes` object or string starting with `b'`) to prevent text column database corruption.
*   **Detailed Guide:** [docs/ai/domain-model.md](file:///c:/Users/dingy/projects/peng-bot/peng-agent/docs/ai/domain-model.md)

---

## 9. Required Quality Gates
Before any code can be merged, it must clear the following quality barriers:
*   **Backend Code:**
    *   Strict `unittest` suite coverage checks. Runs in CI via: `uv run --with coverage coverage run -m unittest discover test`.
    *   Linting and formatting checks enforced via `ruff check` in CI. Run locally using `uv tool run ruff check`.
*   **Frontend Code (Web & Mobile):**
    *   There are **no unit or integration testing frameworks** installed for Web or Mobile.
    *   CI strictly validates files against compilation and ESLint. You MUST verify frontend updates by running `bun run lint` locally.
*   **Detailed Guide:** [docs/ai/testing-guide.md](file:///c:/Users/dingy/projects/peng-bot/peng-agent/docs/ai/testing-guide.md)

---

## 10. Development Conventions
Always conform to the existing codebase styles:
*   **Language & Tooling:** Use `uv` for backend Python and `bun` for frontend TypeScript. Do **not** mix package managers.
*   **Naming Conventions:**
    *   Python: `snake_case` for variables and functions; `PascalCase` for classes and Pydantic schemas.
    *   TypeScript: `PascalCase` for React components and files (`ChatInterface.tsx`); `camelCase` for variables, helper hooks, and thunk actions.
*   **Imports:**
    *   Python: Standard Library first -> Third-party -> Local absolute imports (e.g. `from utils.log import output_log`).
    *   TypeScript: Prefer absolute path aliases starting with `@/` (e.g., `import { AppDispatch } from '@/store';`).
*   **Logging:** Never use print statements. Always use `utils.log.output_log()`.
*   **Async Cleanups:** Always set a local `let mounted = true;` flag in `useEffect` fetch thunks, checking `if (!mounted) return;` inside resolves to prevent memory leaks.
*   **Detailed Guide:** [docs/ai/development-conventions.md](file:///c:/Users/dingy/projects/peng-bot/peng-agent/docs/ai/development-conventions.md)

---

## 11. Risk Areas
Be extremely careful around the following fragile features:
*   **Frontend Code Duplication:** Due to the missing `/app/share` shared state folder, the Redux slices and API hook definitions are duplicated entirely between `/app/web` and `/app/mobile`. Changes in one frontend **MUST** be replicated manually in the other.
*   **Event Loop Starvation:** Ensure all backend database queries are threadpool-bound so FastAPI's asynchronous event loop remains responsive.
*   **Memory and RAG Fragility:** Past version changes (`V2.3.5`, `V2.3.6`) highlight unstable behavior in user custom knowledge bases and memory retrieval.
*   **Detailed Guide:** [docs/ai/risk-register.md](file:///c:/Users/dingy/projects/peng-bot/peng-agent/docs/ai/risk-register.md)

---

## 12. Open Questions
Keep track of these pending design discussions and uncertainties:
*   *Was `/app/share` permanently abandoned?*
*   *Should database columns be migrated from `TEXT` to `LONGTEXT` to stop the 10,240-character truncation?*
*   *Should an async database engine (e.g., `databases` or `asyncpg`) be adopted to fix ASGI event-loop blocking?*
*   *When will Jest/Vitest be introduced to frontend testing to cover Redux state mutations?*
*   **Detailed Guide:** [docs/ai/open-questions.md](file:///c:/Users/dingy/projects/peng-bot/peng-agent/docs/ai/open-questions.md)

---

## 13. Rules for Future Coding Agents
As an AI coding assistant, you must adhere to these absolute boundaries:

### Before making changes, read:
*   [/AGENTS.md](file:///c:/Users/dingy/projects/peng-bot/peng-agent/AGENTS.md)
*   Relevant files under `/docs/ai` based on the task

### While working:
1.  **Follow the documented conventions** precisely.
2.  **If you discover new architecture, commands, contracts, domain rules, risks, or conventions**, update the relevant `/docs/ai` file.
3.  **If something is unclear**, add it to [docs/ai/open-questions.md](file:///c:/Users/dingy/projects/peng-bot/peng-agent/docs/ai/open-questions.md).
4.  **If something is risky or fragile**, add it to [docs/ai/risk-register.md](file:///c:/Users/dingy/projects/peng-bot/peng-agent/docs/ai/risk-register.md).
5.  **If you change APIs**, update [docs/ai/api-contracts.md](file:///c:/Users/dingy/projects/peng-bot/peng-agent/docs/ai/api-contracts.md).
6.  **If you change domain logic**, update [docs/ai/domain-model.md](file:///c:/Users/dingy/projects/peng-bot/peng-agent/docs/ai/domain-model.md).
7.  **If you change tests or commands**, update [docs/ai/testing-guide.md](file:///c:/Users/dingy/projects/peng-bot/peng-agent/docs/ai/testing-guide.md).
8.  **If you change backend/web/mobile architecture**, update the corresponding guide under `/docs/ai/`.
9.  **If the lesson is important for all future agents**, update [/AGENTS.md](file:///c:/Users/dingy/projects/peng-bot/peng-agent/AGENTS.md).
10. **Do not introduce new architecture** or external libraries without explicit instruction.

### At the end of your work, report:
1.  Code files changed
2.  Documentation files changed
3.  Tests/commands run
4.  New knowledge saved
5.  Risks or open questions recorded

