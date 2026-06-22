# Backend Guide (/server)

## 1. Backend Summary
The Peng Agent backend is a monolithic Python application providing RESTful endpoints for an LLM chat system. It handles user authentication, conversation state management (short and long term), file uploads, retrieval augmented generation (RAG), and tool invocation via an AI orchestrator.

## 2. Framework/Runtime
- **Language**: Python 3.12
- **Framework**: FastAPI
- **Server**: Uvicorn
- **AI Orchestration**: LangChain, LangGraph
- **Data Layers**: SQLAlchemy (MySQL), Redis (Caching), Qdrant (Vector DB), MinIO (Object Storage)

## 3. Entry Point
- **File**: `server/main.py`
- **Function**: Executes `api.setup.set_up()` (which provisions DB tables, loads Redis cache, and initializes Datadog APM tracing) before launching the Uvicorn server on the configured `host:port`.

## 4. Directory/Module Map
- `/api/`: FastAPI app configuration (`api.py`), setup script (`setup.py`), and endpoint routers (`routers/`).
- `/config/`: Environment loading and configuration schema (`config.py`).
- `/handlers/`: Route logic, sitting between the router and services (e.g., `auth_handlers.py`).
- `/models/`: SQLAlchemy ORM definitions (`db_models.py`) and Pydantic validation schemas.
- `/services/`: Core business logic and AI agent pipelines (`peng_agent.py`, `prompt_generator.py`).
- `/utils/`: Infrastructure connections and shared utilities (`mysql_connect.py`, `log.py`).
- `/test/`: Standard `unittest` suite files.

## 5. Request Lifecycle
Client Request -> FastAPI Router (`/api/routers/`) -> Handler (`/handlers/`) -> Validation (Pydantic `/models/`) -> Service Layer (`/services/`) -> Data Access (`/utils/` and `/models/db_models.py`) -> Response.

## 6. Route/Controller Structure
Routes are grouped by domain in `/api/routers/` (e.g., `auth_router.py`, `chat_router.py`) and imported into the central FastAPI app in `api.py`. They delegate their business logic to functions in the `handlers/` directory.

## 7. Auth/Authz Flow
Authentication uses JWT (JSON Web Tokens). Handlers use `authenticate_request(request: Request)` from `auth_handlers.py` to extract the `Authorization` header, decode the token, and ensure validity. Passwords are hashed using `bcrypt`.

## 8. Database/Storage Architecture
- **Relational DB (MySQL)**: Accessed via SQLAlchemy ORM (synchronous engine).
- **Cache (Redis)**: Accessed via wrappers in `services/redis_service.py` to reduce database hits. Operator and Model configurations are fully decoupled from MySQL, stored purely in Redis cache, and serialised/loaded to/from S3 (via minio). The adapters in `redis_service.py` support a generic `db_backed: bool = True` parameter to bypass database validation and operations for purely Redis-backed tables.
- **Vector DB (Qdrant)**: Used for RAG.
- **Object Storage (S3/MinIO)**: Manages file uploads (handled in `utils/minio_connection.py`) and stores operator/model spreadsheet configurations.
- **Models/Schemas**:
- **SQLAlchemy (Domain)**: `User`, `Chat`, `AIResponse`, `UserInput`, `ToolCall`, `ToolOutput`, `KnowledgeBase`.
- **Pydantic (Validation)**: E.g., `UserCreate`, `AgentRequest`, used as FastAPI dependency models for automatic schema validation.

## 10. Validation Pattern
Relies on FastAPI's native integration with Pydantic. Request body types dictate the expected schema, and FastAPI handles `422 Unprocessable Entity` returns for malformed requests.

## 11. Error Handling Pattern
The codebase utilizes explicit `try/except` blocks in the `handlers/` layer. Errors are logged using `output_log()`, and HTTP-specific errors are raised using `fastapi.HTTPException`.

## 12. Logging Pattern
A custom logger utility `utils.log.output_log(message, level)` is used throughout the codebase. Additionally, Datadog tracing (`ddtrace`) is initialized at startup for APM observability.

## 13. Background Jobs/Tasks
FastAPI's `BackgroundTasks` are used in model-modifying routes (such as `/model_avaliable`, `/model_multimodal`, `/model_reasoning_effect`, and `/model_refresh`) to asynchronously write/upload updated Redis model configurations back to S3 (`models.xlsx`) after the HTTP response is returned. This eliminates slow, synchronous S3 network IO blockages during request execution.

## 14. External Integrations
- LLM Providers (OpenAI, Anthropic, Gemini, etc.)
- Tavily (Web Search Tool)
- Crawler4ai (Web Scraping Tool)
- Datadog (APM & Tracing)

## 15. Environment Variables
Centralized in `server/config/config.py`. It uses a `pydantic.BaseModel` named `Config` to parse variables, applying defaults (e.g., `mysql_user: root`, `port: 8000`) if OS environment variables are not present.

## 16. Commands
- Run Server: `cd server && python main.py`
- Run Tests: `cd server && uv run --with coverage coverage run -m unittest discover test`

## 17. Backend-Specific Development Workflow
1. Define/Update Pydantic schemas in `/models/`.
2. Update SQLAlchemy models in `/models/db_models.py`.
3. Add business logic to a handler in `/handlers/`.
4. Expose via a router in `/api/routers/`.
5. Write unit tests in `/test/test_handlers_*.py`.

## 18. Files Future Agents Should Read First
1. `server/main.py` and `server/api/setup.py` (Initialization)
2. `server/config/config.py` (Configuration)
3. `server/api/api.py` (Routing)
4. `server/models/db_models.py` (Domain Data)

## Quick Reference Table
| Area | File paths | Notes |
|---|---|---|
| Entry point | `/server/main.py`, `/server/api/api.py` | FastAPI app initialization |
| Auth | `/server/handlers/auth_handlers.py` | JWT and bcrypt logic |
| Database | `/server/models/db_models.py`, `/server/utils/mysql_connect.py` | SQLAlchemy sync engine setup |
| Routes | `/server/api/routers/*.py` | Domain-grouped endpoints |
| Tests | `/server/test/` | Standard Python `unittest` suite |
