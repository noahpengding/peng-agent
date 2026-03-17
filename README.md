# Peng Agent

[![Build and Deploy](https://github.com/noahpengding/peng-agent/actions/workflows/build-and-deploy.yml/badge.svg)](https://github.com/noahpengding/peng-agent/actions/workflows/build-and-deploy.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE.md)

Peng Agent is a full stack LLM chat system with:

- Python FastAPI backend
- React web frontend
- Expo React Native mobile app
- Shared TypeScript store and services used by web and mobile
- Tool calling, retrieval augmented generation, and streaming responses

## Tech Stack

### Backend

- Python 3.12
- FastAPI and Uvicorn
- LangChain and LangGraph
- SQLAlchemy with MySQL
- Redis cache layer
- Qdrant vector database
- ddtrace and Datadog LLM observability

### Frontend

- Bun
- TypeScript
- Vite
- React 19
- Redux Toolkit
- TailwindCSS

### Mobile

- Expo 55
- React Native 0.83
- React Navigation
- Expo Secure Store

## Repository Layout

```text
.
├─ app/
│  ├─ web/        # React + Vite frontend
│  ├─ mobile/     # Expo React Native app
│  └─ share/      # Shared Redux store, services, hooks, and types
├─ server/        # FastAPI API, handlers, services, models, utils
└─ test/          # Docker Compose files and environment files
```

## Architecture Overview

- Backend entrypoint is `server/main.py`, which initializes database and cache setup, then starts Uvicorn.
- FastAPI app is configured in `server/api/api.py` with `root_path` set to `/api`.
- Routers are split by domain:
	- Authentication
	- Chat and chat feedback
	- Memory
	- Models and operators
	- RAG and collection listing
	- Tools
	- Upload
	- User profile and token regeneration
- Agent orchestration is implemented with LangGraph in `server/services/peng_agent.py`.
- LLM runtime adapters include OpenAI response/completion style APIs, Claude, Gemini, XAI, and OpenRouter.
- Web and mobile both use the shared Redux store from `app/share/src/store`.

## Prerequisites

- Docker and Docker Compose
- Python 3.12+
- Bun

## Environment Configuration

### Backend

Use `server/.env_sample` as the variable reference.

Common variables include:

- API host and port
- MySQL connection values
- Redis connection values
- Qdrant host and port
- S3 or MinIO credentials
- JWT secret and admin password
- LLM provider keys and defaults

### Frontend

Web dev environment values are in `test/front.env`.

Key values include:

- `VITE_BACKEND_URL`
- Datadog browser telemetry variables

### Mobile

Mobile reads API URL from Expo config extra values in `app/mobile/app.config.js`.

## Quick Start

### 1. Start dependencies with Docker

From the repository root:

```bash
cd test
docker compose up -d
```

This starts:

- Qdrant
- MySQL
- Redis

### 2. Start backend

From the repository root:

```bash
cd server
python main.py
```

Default API address is controlled by environment.

- FastAPI root path is `/api`
- If `PORT` is not set, backend defaults to `8000`

### 3. Start web frontend

From the repository root:

```bash
cd app/web
bun install
bun run dev
```

Web dev server runs on port `3000`.

### 4. Start mobile app

From the repository root:

```bash
cd app/mobile
bun install
bun run start
```

Then run on emulator/device with Expo.

## Dockerized Full Stack Options

Under `test/`:

- `docker-compose.yml`: core dependencies only (Qdrant, MySQL, Redis)
- `docker-compose_with_app.yml`: dependencies plus backend and web containers
- `docker-compose_with_ollama.yml`: Ollama and Open WebUI stack

## Backend Details

### Main API Routes

- `POST /api/login`
- `POST /api/signup`
- `POST /api/chat`
- `POST /api/chat_completions`
- `POST /api/chat_feedback`
- `GET|POST /api/rag`
- `GET /api/collection`
- `GET|POST /api/tools`
- `GET /api/tool/{tool_name}`
- `POST /api/upload`
- `GET|PUT /api/user/profile`
- `POST /api/user/regenerate_token`
- `GET|POST /api/operator`
- `GET /api/model` and related model control endpoints

### Data Layer

SQLAlchemy models include tables for:

- users
- operators
- models
- tools
- chats
- user input
- AI responses and reasoning
- tool calls and outputs
- knowledge base metadata

Redis is used as a cache layer for selected tables and sync operations.

## Frontend and Shared Package Details

- Web routing and auth gating are handled in `app/web/src/index.tsx`.
- Runtime web config is provided through `app/web/public/config.js`.
- Shared API base logic and transport utilities live in `app/share/src/utils`.
- Chat streaming handling and chunk typing are managed in `app/share/src/services/chatService.ts` and `app/share/src/store/slices/chatSlice.ts`.

## Development Commands

### Web

```bash
cd app/web
bun run dev
bun run lint
bun run build
```

### Backend

```bash
cd server
python main.py
```

### Mobile

```bash
cd app/mobile
bun run start
bun run android
bun run ios
```

## Notes

- This repository includes committed build artifacts in `app/web/dist` and local environment artifacts under some subfolders. Clean these before packaging if needed.
- Server tests and experiments are in `server/test/`.

## License

See `LICENSE.md`.
