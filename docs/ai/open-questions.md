# Open Questions

## Unresolved Queries
- **Where is `/app/share`?** The root `README.md` explicitly references an `app/share` directory for shared TypeScript state and logic between Web and Mobile, but it does not appear in the filesystem. Was it removed or relocated? It appears the Redux slices and API services were duplicated instead. Was `app/share` abandoned?
- **How are API contracts enforced?** Is there a tool (like OpenAPI code generation) keeping the Python backend and TypeScript frontends in sync, or is it done manually?
- **Are there mobile unit tests?** The README highlights backend unit tests but does not document how to test the React Native application. (Resolved: there are no tests).
- **Async/Sync Blocking?** Does the use of synchronous SQLAlchemy calls (`create_engine`) within FastAPI's asynchronous (`async def`) routes cause event loop blocking under load? Should these be migrated to `run_in_threadpool` or an async SQLAlchemy engine?
- **Will Web Tests be Introduced?** Currently there are no web test frameworks configured. Is there a plan to introduce Vitest/Jest to the `/app/web` workspace to mitigate regression risks?
- **Database String Truncation Data Loss?** The backend explicitly truncates AI outputs to `10240` characters to fit into MySQL Text fields. Is the resultant data loss for massive outputs acceptable, or should these columns be migrated to `MEDIUMTEXT`/`LONGTEXT` to fully support modern LLM context windows?
- **Frontend Test Strategy?** With zero testing frameworks installed in both Web and Mobile directories, how does the team plan to safely refactor the heavily duplicated Redux slices? Is there an intention to install Vitest or Jest?
- **Component Bloat Strategy?** `ChatScreen.tsx` is >1100 lines and `ChatInterface.tsx` is >600 lines. Are there plans to break these down into smaller atomic components (e.g., `MessageBubble`, `InputBar`), or should future agents continue adding to the monolithic files?

## Investigation Backlog
- Investigate the API synchronization mechanism between FastAPI and TypeScript. (Resolved: None exists).
- Determine the correct testing conventions for the Web and Mobile layers, as only the backend tests were prominently featured in the README. (Resolved: Web and Mobile have zero tests).
