# Repository Inventory

## 1. Repository Overview
Peng Agent is a full stack LLM chat system. It includes a Python FastAPI backend, a React web frontend, an Expo React Native mobile app, and potentially shared TypeScript services. Features include tool calling, retrieval augmented generation (RAG), and streaming responses.

## 2. Directory Map
- `/server/`: Python FastAPI backend.
- `/app/web/`: React + Vite web frontend.
- `/app/mobile/`: Expo React Native mobile application.
- `/test/`: Docker Compose and environment configuration files.
- `/.github/`: GitHub Actions workflows.

## 3. Main Technologies Detected
- **Backend**: Python 3.12, FastAPI, Uvicorn, LangChain, LangGraph, SQLAlchemy, MySQL, Redis, Qdrant.
- **Web Frontend**: TypeScript, React 19, Vite, Redux Toolkit, TailwindCSS.
- **Mobile Frontend**: Expo 55, React Native 0.83, React Navigation.

## 4. Package Managers Detected
- **Backend**: `uv` (for Python, via `uv.lock` and `pyproject.toml`).
- **Frontend/Mobile**: `bun` (for TypeScript/JS, via `bun.lock` and `package.json`).

## 5. Important Entry Points
- **Backend**: `/server/main.py`
- **Web Frontend**: `/app/web/src/index.tsx` (or `index.html`)
- **Mobile Frontend**: `/app/mobile/index.ts` / `/app/mobile/App.tsx`

## 6. Important Config Files
- **Backend**: `/server/pyproject.toml`
- **Web Frontend**: `/app/web/vite.config.ts`, `/app/web/tailwind.config.js`
- **Mobile Frontend**: `/app/mobile/app.config.js`, `/app/mobile/eas.json`
- **Docker**: `/test/docker-compose.yml`, `/test/docker-compose_with_app.yml`

## 7. Build, Run, Lint, Test Commands
- **Backend**:
  - Run: `cd server && python main.py`
  - Test: `cd server && uv run --with coverage coverage run -m unittest discover test`
- **Web Frontend**:
  - Install: `cd app/web && bun install`
  - Run: `cd app/web && bun run dev`
  - Lint: `cd app/web && bun run lint`
  - Build: `cd app/web && bun run build`
- **Mobile Frontend**:
  - Install: `cd app/mobile && bun install`
  - Run: `cd app/mobile && bun run start`
- **Docker Stack**:
  - Run: `cd test && docker compose up -d`

## 8. Environment/Config Files
- `/server/.env_sample`: Backend variable reference.
- `/test/front.env`: Web development environment values.
- `/app/web/public/config.js`: Runtime web config.

## 9. CI/CD Files
- `/.gitlab-ci.yml`: GitLab CI/CD pipeline configuration.
- `/.github/workflows/build-and-deploy.yml`: GitHub Actions pipeline.

## 10. Architectural Boundaries
- **Backend API**: Serves RESTful endpoints (e.g., `/api/chat`, `/api/login`) prefixed with `/api`.
- **Clients**: Web and Mobile applications communicate with the backend over HTTP.
- **State**: Both frontends use Redux Toolkit for state management, possibly shared.

## 11. Unknowns or Assumptions
- The root `README.md` mentions an `/app/share/` directory containing shared Redux store, services, hooks, and types used by both web and mobile, but this directory does not exist in the `/app` folder.
- It is assumed that there is no automated API client generation between Python and TypeScript since no openapi-generator or similar script was explicitly identified yet.
