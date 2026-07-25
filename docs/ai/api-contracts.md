# API Contracts

## 1. API Architecture Summary
The Peng Agent utilizes a centralized monolithic API architecture powered by FastAPI. Both the Web and Mobile frontends act as identical consumers, hitting the exact same endpoint surface. There is no middle-for-frontend (BFF) layer. Communication is stateless and secured via JWT Bearer authentication.

## 2. Backend Route Groups
FastAPI groups endpoints logically using `APIRouter`. The primary groups located in `server/api/routers/` are:
- `auth_router.py`: Handles `/login` and `/signup`.
- `chat_router.py`: Handles `/chat` (streaming), `/chat_completions`, and `/chat_feedback`.
- `memory_router.py`: Handles memory updates and retrieval.
- `model_router.py`: Retrieves available base and embedding LLMs.
- `operator_router.py`: Manages agent execution profiles.
- `rag_router.py`: Handles semantic search and document parsing.
- `tools_router.py`: Lists available function-calling tools.
- `upload_router.py`: Handles raw file and image uploads.
- `user_router.py`: Manages user profile settings and long-term memory config.

## 3. Auth/Session/Token Flow
1. Client (Web/Mobile) POSTs credentials to `/login`.
2. Backend authenticates via `handlers.auth_handlers.authenticate_user` and generates a JWT.
3. Backend responds with `{"access_token": "...", "token_type": "bearer"}`.
4. Client persists the token:
   - **Web**: `localStorage` (via `utils/storage.ts`).
   - **Mobile**: `expo-secure-store` (via `utils/storage.ts`).
5. Subsequent requests are intercepted by `apiCall` (in `utils/apiUtils.ts` or `utils/apiCall.ts`) and injected with `Authorization: Bearer <token>`.
6. Backend intercepts requests via FastAPI dependency injection: `Depends(authenticate_request)`.

## 4. Request/Response Conventions
- All incoming requests expect `application/json` (except file uploads which use `multipart/form-data`).
- Validations are performed strictly by **Pydantic** models (e.g., `ChatRequest`, `UserLogin`).

## 5. Error Response Conventions
- Failing Pydantic validation yields a strict **HTTP 422 Unprocessable Entity**.
- Business logic errors yield **HTTP 400 Bad Request** or **HTTP 404 Not Found** with a JSON body `{"detail": "Error message"}` via `fastapi.HTTPException`.
- Authentication failures yield **HTTP 401 Unauthorized**, which triggers a global interceptor on both frontends to clear the local token and redirect to the Login screen.

## 6. Shared Types/Schemas/Generated Clients
- **None exist.** The repository does not utilize OpenAPI generators (like Swagger Codegen or Orval) or shared RPC definitions (like tRPC/gRPC).
- TypeScript interfaces are written **manually** inside the `/services/*.ts` files to mimic the Pydantic models in `/server/models/*.py`.

## 7. Duplicated Types and Mismatch Risk
Because types are handwritten and duplicated across three completely separate directories (`/server/models`, `/app/web/src/services`, `/app/mobile/src/services`), there is severe mismatch risk.
- *Example Mismatch:* In `agent_request.py`, `message` is typed as `Union[str, List[str]]`. In the TS `ChatRequest`, it is strictly `message: string`.
- *Example Mismatch:* In `agent_request.py`, `image` is typed as `Union[str, List[str]]`. In TS, it is strictly `image?: string[]`.

## 8. API Versioning Strategy
- **None.** Endpoints do not contain version identifiers (e.g., `/v1/chat`). All changes are currently mutating the live v0 structure.

## 9. Rules for Safely Changing APIs
1. If you modify a Pydantic model in `/server/models/`, you MUST search for the corresponding TypeScript interface in `/app/web/src/services/` AND `/app/mobile/src/services/` and update them identically.
2. If you add a new endpoint to `/server/api/routers/`, you MUST create the corresponding Axios service call in both frontends.

---

## Route Mappings Table

| Backend route/group | Server files | Web usage | Mobile usage | Notes |
|---|---|---|---|---|
| `POST /login` | `auth_router.py` | `Login.tsx` | `LoginScreen.tsx` | Issues JWT Token |
| `POST /chat` | `chat_router.py` | `chatService.ts` | `chatService.ts` | Streaming Server-Sent Events (SSE) |
| `POST /chat_feedback` | `chat_router.py` | `chatService.ts` | `chatService.ts` | Submits Upvote/Downvote |
| `/memory` endpoints | `memory_router.py` | `memoryService.ts` | `memoryService.ts` | Manages LLM context |
| `/model` endpoints | `model_router.py` | `modelService.ts` | `modelService.ts` | Lists providers |
| `/rag` endpoints | `rag_router.py` | `ragService.ts` | `ragService.ts` | Document ingestion |

## Contract Shapes Table

| Contract | Request shape | Response shape | Validation | Consumers |
|---|---|---|---|---|
| **Login** | `{"username", "password"}` | `{"access_token", "token_type"}` | Pydantic `UserLogin` | Web & Mobile Auth Flow |
| **Chat Stream** | `{"user_name", "message", "knowledge_base", "config": {"operator", "base_model", "tools_name", "short_term_memory", "ip_address"}}` | `text/event-stream` chunks | Pydantic `ChatRequest` | Web & Mobile Chat UI |
| **Feedback** | `{"chat_id", "user_name", "feedback"}` | `{"message", "chat_id", "feedback"}` | Pydantic `ChatFeedbackRequest` | Web & Mobile Message Items |
| **Memory Page** | `{"user_name", "page", "search"}` | `{"memories", "page", "page_size", "total_count", "total_pages", "has_next", "has_previous", "search"}` | Dict body in `memory_router.py`; handler clamps page and uses fixed `page_size` 20 | Web & Mobile Memory Selection |

### Memory Pagination Notes
- `POST /memory` returns a paged envelope instead of a bare array. `page` is 1-based, `page_size` is fixed at 20, and out-of-range pages are clamped to the available page range.
- `search` is optional and server-side; matching applies to human input, AI response, and base model for completed memories with a non-empty AI response.
- Web and mobile both keep selected memory objects outside the current page so selections from multiple pages can be loaded together into short-term memory.

### Chat IP Address Notes
- Web and mobile resolve the current public egress IP immediately after a chat send is dispatched and add it as `config.ip_address` before posting to `/chat`.
- IP resolution is best-effort with a three-second timeout. If the lookup fails, clients send an empty string so chat remains available and the backend omits location context.

### Chat Retry Notes
- Retry reuses the existing `POST /chat` contract; it does not require a separate backend route.
- Each client snapshots the fully resolved request after a successful turn. A retry resends that snapshot, including its original `config.ip_address`.
- Before replay, the client restores the saved pre-turn `short_term_memory` list. The completed chat ID being replaced therefore remains persisted server-side but is excluded from the active conversation context and replaced by the newly completed chat ID.
