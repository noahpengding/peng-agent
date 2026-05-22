# Documentation and History

## 1. Existing Documented Architecture
- **Backend:** Python FastAPI with Uvicorn, LangChain/LangGraph for orchestration. SQLAlchemy with MySQL for persistent data. Redis for caching, Qdrant for vector storage (RAG).
- **Frontend:** React + Vite (Web) and Expo React Native (Mobile) utilizing Redux Toolkit.
- **Integrations:** Datadog for tracing/observability, S3/MinIO for file storage.

## 2. Product/Domain Concepts
- **LLM Agent Chat System:** A conversational interface supporting multiple LLMs (OpenAI, Claude, Gemini, etc.).
- **RAG (Retrieval-Augmented Generation):** Qdrant vector database is used for semantic knowledge retrieval.
- **Memory:** Both short-term (session) and long-term memory capabilities (via Redis and database).
- **Tool Calling:** Agents can execute code, fetch data (Craw4ai), and interact with external resources.

## 3. Important Historical Decisions
- **V2.2.0:** Introduction of advanced reasoning and tool support.
- **V2.3.3:** Adoption of Datadog tracing for observability and DB Singleton improvements.
- **V2.4.0:** Implementation of Long-Term Memory and Redis layer.
- **V2.4.2:** Complete front UI remake prioritizing a "Technical & Moody" dark-mode aesthetic and introduction of the Mobile App.
- **V2.4.3:** Redux chat streaming optimization. Transitioned to direct array mutation via Immer to prevent $O(n)$ array allocations during high-frequency text streaming.

## 4. Commit Hashes for Major Relevant Changes
- `0470a92`: V2.4.0 - User Profile, Feedback, Long-Term Memory, Redis Implements.
- `ff97ca8`: v2.4.2 - Front UI remake and Mobile App.
- `d85297a`: V2.4.3 - Unit testing budget set (50%+) and Redux streaming optimizations.

## 5. Deprecated or Legacy Patterns
- *Unknown explicitly at this time*, though previous web crawler implementations were replaced by `craw4ai`.

## 6. Migrations or Rewrites in Progress
- The front-end UI recently underwent a massive "Technical & Moody" redesign. Some old generic SaaS styling or classes may still linger.

## 7. Documentation/Code Inconsistencies
- The root `README.md` refers to an `app/share` directory for shared TypeScript store/services, but the actual filesystem lacks this directory, housing only `web` and `mobile`.

## 8. Documentation Gaps
- There are no detailed guidelines for how API schemas stay synchronized between FastAPI and the TypeScript clients.
- Mobile testing protocols are entirely undocumented in the README.
