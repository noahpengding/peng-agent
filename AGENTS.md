# Agent Context

## Working Rules
- Read this file and the relevant `docs/ai/*` guides before changing code.
- Prefer `apply_patch` for edits and avoid destructive git/file commands.
- Keep backend, web, and mobile changes aligned with the documented contracts and conventions.
- If you discover new architecture, commands, contracts, risks, or domain rules, update the relevant doc under `docs/ai/`.
- If backend Pydantic models change, manually update the matching TypeScript interfaces in both frontends.
- Do not introduce new architecture or third-party libraries without explicit instruction.
- At the end of a task, report changed code files, docs updated, commands run, knowledge saved, and any risks or open questions.

## Repository Purpose
Peng Agent is a monolithic AI conversation platform for interacting with LLM providers through distinct Operators and Models. It supports chat streaming, reasoning traces, tool calls and outputs, memory, RAG knowledge bases, uploads, and user preferences. See `docs/ai/README.md` and `docs/ai/documentation-and-history.md`.

## Architecture Overview
- Backend: `server/` is a FastAPI application on Python 3.12. `server/main.py` calls `api.setup.set_up()` and then starts Uvicorn on port `8000`.
- Backend layering: routers in `server/api/routers/` delegate to handlers, then services, then utils and models. Main data stores are MySQL via synchronous SQLAlchemy, Redis cache, Qdrant for vectors, MinIO/S3 for files, and Datadog for tracing.
- Web: `app/web/` is a React 19 + Vite + TypeScript + Bun SPA with Redux Toolkit. `src/index.tsx` mounts the app and `src/App.tsx` wraps the router with Redux.
- Mobile: `app/mobile/` is an Expo 55 + React Native + TypeScript + Bun app using Redux Toolkit and React Navigation v7. `index.ts` and `App.tsx` bootstrap navigation and auth hydration.
- Cross-cutting: API contracts are handwritten and duplicated between web and mobile service layers. There is no shared `/app/share` package in the repo today.
- Request flow: router -> handler -> validation/model -> service -> storage/cache -> response. Chat responses stream as SSE chunks that are buffered by chunk type before persistence.

## Important Directories and Files
- `server/main.py`: backend entry point.
- `server/api/`: FastAPI app setup and routers.
- `server/config/config.py`: environment/config parsing.
- `server/models/`: SQLAlchemy models and Pydantic schemas.
- `server/handlers/` and `server/services/`: business logic and agent orchestration.
- `server/utils/`: logging, MySQL, MinIO, and other shared infrastructure helpers.
- `server/test/`: backend `unittest` suite.
- `app/web/src/index.tsx` and `app/web/src/App.tsx`: web app entry points.
- `app/web/src/store/` and `app/web/src/services/`: Redux state and API client definitions.
- `app/mobile/index.ts` and `app/mobile/App.tsx`: mobile app entry points.
- `app/mobile/src/store/` and `app/mobile/src/services/`: mobile Redux state and API client definitions.
- `docs/ai/`: the repo knowledge base and operating guides.
- `test/`: Docker Compose files and environment samples used for local stack setup.
- `/.github/workflows/` and `/.gitlab-ci.yml`: CI/CD definitions.

## Development Workflow
- Backend install/run: use `uv`; start with `cd server && python main.py`.
- Backend tests: `cd server && uv run --with coverage coverage run -m unittest discover test`.
- Backend lint: `cd server && uv tool run ruff check`.
- Web install/run: use `bun`; `cd app/web && bun install`, then `bun run dev`.
- Web build/lint: `cd app/web && bun run build` and `cd app/web && bun run lint`.
- Mobile install/run: `cd app/mobile && bun install`, then `bun run start`, `bun run android`, or `bun run ios`.
- Mobile lint: `cd app/mobile && bun run lint`.
- Local stack: `cd test && docker compose up -d`.
- When changing backend models or route shapes, update both frontends manually in lockstep.

## Testing Strategy
- Backend uses stdlib `unittest` with heavy mocking and coverage tracking. CI enforces backend tests, coverage, and `ruff`.
- The documented backend coverage budget is 50% or higher.
- Web and mobile currently have no Jest/Vitest/Detox-style test suites. Quality is verified with linting and, for web, production build/typecheck.
- Frontend regressions in streaming state and Redux mutations are especially risky because there are no automated UI or state tests.

## Deployment / Release Notes
- CI/CD exists in both GitHub Actions and GitLab pipeline configuration.
- Backend runtime configuration is centralized in `server/config/config.py` and documented through `server/.env_sample`.
- Web runtime configuration is driven by Vite env vars and `app/web/public/config.js`; local env defaults are referenced through `test/front.env`.
- Mobile configuration is driven by `app/mobile/app.config.js` and `app/mobile/eas.json` for EAS profiles.
- Datadog tracing/RUM is part of the documented runtime setup.

## Coding Conventions
- Use `uv` for Python and `bun` for TypeScript. Do not use `npm`, `yarn`, or `pip` directly.
- Python naming: `snake_case` for functions and variables, `PascalCase` for classes and Pydantic models.
- TypeScript naming: `PascalCase` for React components/files, `camelCase` for hooks, helpers, and local variables.
- Python imports should follow standard library -> third-party -> local absolute imports.
- Use `utils.log.output_log()` instead of `print()`.
- Do not run blocking MySQL/SQLAlchemy work directly inside `async def` FastAPI routes; use a threadpool for synchronous I/O.
- Use `@/` path aliases in frontend TypeScript where available.
- Preserve `useMemo` and `useCallback` around large streaming UI lists, and keep `let mounted = true;` cleanup patterns in `useEffect` fetch flows.
- Because web and mobile are not shared from a common package, duplicate frontend state/service changes intentionally in both apps.

## Domain Knowledge
- Core terms: Operator = provider/runtime, Model = a specific model, Chat = a conversation session, Reasoning = exposed internal thought blocks, Knowledge Base = uploaded RAG corpus.
- Main entities: User, Operator, Model, Chat, UserInput, AIResponse, AIReasoning, ToolCall, ToolOutput, KnowledgeBase.
- Chat execution creates Chat/UserInput records immediately, then streams agent chunk types such as `output_text`, `reasoning_summary`, `tool_call`, and `tool_output`.
- Streaming buffers are flushed when the chunk type changes or the stream ends.
- Auth uses JWT bearer tokens. Web stores the token in `localStorage`; mobile stores it in `expo-secure-store`.
- Standard login tokens expire in 7 days. User-created API tokens are non-expiring.
- Feedback endpoints verify the submitted user against the JWT subject.
- Domain truncation rules are strict: `human_input` max 4096 chars; `AIResponse`, `AIReasoning`, and `ToolOutput` max 10240 chars before DB insert.
- Binary `ToolOutput` values are skipped to avoid text-column corruption.
- A blank password during signup can produce a generated secure token.

## Known Constraints and Gotchas
- There is no OpenAPI/codegen/tRPC layer; backend Pydantic models and frontend TypeScript interfaces are manually synchronized.
- Older docs mention `/app/share`, but that directory is absent; the current repo duplicates web and mobile state/service logic instead.
- The backend uses synchronous SQLAlchemy with async FastAPI endpoints, so event-loop blocking is a real risk if sync I/O is not offloaded.
- Chat streaming is performance-sensitive; avoid expensive array rebuilds in hot paths and prefer Immer-style mutation patterns.
- RAG and memory flows have been historically fragile.
- Large AI outputs are silently truncated, which can destroy long code snippets or tool traces.
- Web and mobile have no automated tests, so lint/build are the main safety net.
- Dynamic error messages should preserve accessibility semantics such as `role="alert"` and `aria-live="assertive"` where applicable.

## Source Docs Read
- `docs/ai/README.md`
- `docs/ai/backend-guide.md`
- `docs/ai/web-guide.md`
- `docs/ai/mobile-guide.md`
- `docs/ai/api-contracts.md`
- `docs/ai/domain-model.md`
- `docs/ai/testing-guide.md`
- `docs/ai/development-conventions.md`
- `docs/ai/risk-register.md`
- `docs/ai/open-questions.md`
- `docs/ai/repo-inventory.md`
- `docs/ai/documentation-and-history.md`
