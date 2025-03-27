# CLAUDE.md - Agent Instructions

## Commands
- Server: `cd server && python main.py` (backend)
- Web: `cd web && bun run dev` (frontend)
- Lint: 
  - Web: `cd web && bun run lint`
- Build: `cd web && bun run build`

## Code Style

### Python (Server)
- Imports: Standard library first, then third-party, then local
- Types: Pydantic models for validation
- Error handling: Use try/except with specific exceptions
- Logging: Use utils/log.py with appropriate log levels
- Naming: snake_case for variables/functions, PascalCase for classes

### TypeScript/React (Web)
- Types: Define interfaces for components
- State management: React hooks
- Error handling: try/catch with specific error types
- CSS: Component-specific CSS files + TailwindCSS
- API calls: Use service modules via hooks