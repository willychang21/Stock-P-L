# Stock P:L — Investment Portfolio Tracker

Personal full-stack app for tracking investment P/L. Data stored locally (DuckDB), prices fetched via Yahoo Finance.

## Tech Stack

| Layer     | Technology                                        |
| --------- | ------------------------------------------------- |
| Backend   | Python 3.10+, FastAPI, DuckDB, Pydantic, yfinance |
| Frontend  | React 18, TypeScript, Vite, MUI 5, TailwindCSS 3  |
| State     | Zustand                                           |
| Charts    | Recharts                                          |
| i18n      | react-i18next (zh-TW / en)                        |
| Testing   | pytest (backend), vitest (frontend)               |
| Formatter | Prettier (frontend)                               |

## Architecture

Hexagonal (Layered) architecture, both frontend and backend:

```
backend/app/
├── core/             # Domain entities & port interfaces
├── services/         # Application services (use cases)
├── infrastructure/   # Adapters (DuckDB, external APIs)
├── api/              # FastAPI endpoints
├── models/           # ORM / data models
├── schemas/          # Pydantic request/response schemas
└── db/               # Database initialization

frontend/src/
├── domain/           # Pure domain logic (models, calculators, ports)
├── application/      # Application services (use cases, Zustand stores)
├── infrastructure/   # Adapters (API client, repositories)
└── presentation/     # React components, pages, hooks
```

Key patterns: Strategy (FIFO/weighted-average calculators), Repository, Result.

## Commands

```bash
# Backend (from project root)
./backend/scripts/dev.sh          # FastAPI → http://localhost:3001

# Frontend (from frontend/)
npm run dev                       # Vite → http://localhost:5173

# Tests
cd backend && source venv/bin/activate && pytest
cd frontend && npm test

# Format
cd frontend && npm run format

# Build (catches TS errors)
cd frontend && npm run build
```

## Important Notes

- IMPORTANT: The project path contains `:` which breaks Python venv. `dev.sh` handles this by symlinking venv to `/tmp/stock_pl_venv`. Never create venv directly in the project directory.
- Vite proxies `/api/yahoo` → Yahoo Finance to bypass CORS. Backend API base is `http://localhost:3001`.
- Swagger UI at `http://localhost:3001/docs` when backend is running.
- Frontend path aliases: `@domain`, `@application`, `@infrastructure`, `@presentation` (configured in `vite.config.ts` and `tsconfig.json`).

## Verification

Always verify changes with:

1. `npm run build` in `frontend/` — catches TypeScript errors
2. Run relevant tests (`pytest` or `npm test`)
3. Check both frontend (5173) and backend (3001) are running after changes

## Additional Context

For deeper context on specific topics, see:

- Architecture design: @specs/
- Backend API routes: @backend/app/api/
- Database schema: @backend/app/db/init_db.py
- Frontend routing & pages: @frontend/src/presentation/
