# Testing and Quality Guide

## 1. Test Strategy Summary
The repository employs an asymmetric testing strategy. The Python backend is strictly tested using isolated unit tests with rigid mocking and coverage tracking. Conversely, both the Web and Mobile frontends completely lack testing frameworks and rely solely on static analysis (linting) and TypeScript compilation for quality assurance. CI pipelines enforce these quality gates before allowing builds.

## 2. Test Frameworks by Area

### `/server` (Backend)
- **Framework**: `unittest` (Standard Library)
- **Coverage**: `coverage`
- **Linting & Formatting**: `ruff`
- **Package Management**: `uv`

### `/app/web` (Web Frontend)
- **Framework**: *None* (No Jest, Vitest, Cypress, or Playwright)
- **Linting & Formatting**: `eslint`, `prettier`
- **Package Management**: `bun`

### `/app/mobile` (Mobile Frontend)
- **Framework**: *None* (No Jest, Detox, or Appium)
- **Linting**: `eslint`
- **Package Management**: `bun`

## 3. How to Run Each Test Suite

| Area | Framework | Command | Test path | Notes |
|---|---|---|---|---|
| Backend | `unittest` | `uv run python -m unittest discover -s test` | `server/test/` | Runs isolated unit tests |
| Backend | `coverage` | `uv run --with coverage coverage run -m unittest discover test` | `server/test/` | Generates coverage metrics |
| Web | N/A | N/A | N/A | Testing missing |
| Mobile | N/A | N/A | N/A | Testing missing |

## 4. How to Run Lint/Format/Typecheck

- **Backend Linting**: `cd server && uv tool run ruff check`
- **Web Linting**: `cd app/web && bun run lint`
- **Web Formatting**: `cd app/web && bun run format` (runs Prettier)
- **Web Typecheck**: `cd app/web && bun run build` (runs `tsc -b`)
- **Mobile Linting**: `cd app/mobile && bun run lint`

## 5. How Test Data is Created
Test data in the backend is entirely mocked inline within the test files. There are no dedicated test database seeders or global factories. Data structures (like fake JWT tokens or database records) are instantiated manually as dictionaries in the test cases.

## 6. Mocking/Stubbing Conventions
The backend heavily relies on `unittest.mock`.
- **Database/Redis Isolation**: External calls are consistently intercepted using `@patch` decorators (e.g., `@patch('handlers.auth_handlers.get_table_record')`).
- **Object Mocking**: FastAPI requests and dependencies are stubbed using `MagicMock()` (e.g., simulating HTTP headers).

## 7. Critical Flows Covered by Tests
- **Authentication**: JWT token generation, parsing, and validation (`test_handlers_auth.py`).
- **Database Utilities**: Connection string generation, query formatting (`test_mysql_connect*.py`).
- **API Routers**: Basic connectivity and response shapes (`test_api_routers.py`).

## 8. Critical Flows Not Obviously Covered
- **Integration Tests**: There are no tests verifying the actual database persistence logic end-to-end.
- **Frontend State (Redux)**: Zero tests for the complex chat streaming array mutations in the Web/Mobile Redux slices.
- **UI Testing**: Zero visual regression, E2E, or component tests.

## 9. CI Quality Gates

| Quality gate | Command/config | Required before merge? | Notes |
|---|---|---|---|
| Backend Unit Tests | `uv run python -m unittest ...` | Yes | Runs on GitHub Actions |
| Backend Coverage | `coverage run ...` -> Datadog | Yes | Uploads report to Datadog |
| Backend Lint | `ruff check` | Yes | Fails pipeline on lint errors |
| Web Lint | `bun run lint` | Yes | Fails pipeline on lint errors |
| Mobile Lint | `bun run lint` | Yes | Fails pipeline on lint errors |
| CodeQL Security | `github/codeql-action` | Yes | Scans Python & Javascript code |

## 10. Recommended Tests for Future Changes
If making substantial changes, agents should:
1. Continue utilizing `@patch` to mock database interactions in `/server/test/`.
2. Propose introducing a lightweight frontend test runner (e.g., Vitest) if touching the deeply complicated `chatSlice.ts` to prevent UI streaming regressions.
