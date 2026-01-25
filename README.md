# Investment Portfolio Tracker

A **full-stack web application** for personal investment tracking and P/L analysis. Built with a **Python/FastAPI** backend for robust data processing and a **React** frontend for a modern user experience.

## Architecture

This application follows a **Strict Layered (Hexagonal) Architecture** to ensure maintainability, extensibility, and testability:

- **Domain Layer**: Pure business logic (Entities, Value Objects, Port Interfaces). No external dependencies.
  - *Location*: `src/domain/`, `backend/app/core/domain/`
- **Application Layer**: Orchestrates domain logic via Services (Use Cases).
  - *Location*: `src/application/`, `backend/app/services/`
- **Infrastructure Layer**: Implementation of port interfaces (API clients, Database repositories, Market data adapters).
  - *Location*: `src/infrastructure/`, `backend/app/infrastructure/`
- **Presentation Layer**: UI Components (React) and API Endpoints (FastAPI).
  - *Location*: `src/presentation/`, `backend/app/api/`

### Key Design Patterns

- **Strategy Pattern**: Decoupled portfolio calculators (FIFO, Weighted Average) that can be selected at runtime.
- **Repository Pattern**: Abstracted data access to isolate the domain from storage details (DuckDB/LocalStorage).
- **Result Pattern**: Standardized error handling across the stack.

## Features

✅ **Transaction Management**

- Server-side CSV import (Robinhood, Charles Schwab)
- Automatic deduplication via content hashing
- Persistent storage using DuckDB

✅ **P/L Calculation**

- FIFO (First-In-First-Out) cost basis logic (In Progress)
- Realized and unrealized P/L tracking
- Per-symbol P/L breakdown

✅ **Market Data**

- **Real-time Quotes**: Automatic fetching via Yahoo Finance proxy
- No manual price entry required

✅ **Privacy Focused**

- Data stored locally on your machine (DuckDB file)
- No external cloud sync required (Self-hosted/Localhost)

## Prerequisites

- **Python 3.10+** (for backend)
- **Node.js 18+** (for frontend)

## Quick Start

### 1. Setup Backend

Navigate to the `backend` directory and set up the Python environment:

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`

# Install dependencies
pip3 install -r requirements.txt

# Initialize Database
python3 -m app.db.init_db
```

### 2. Run Application

You need to run both the backend and frontend servers.

**Terminal 1 (Backend):**

```bash
# From project root or /backend
./backend/scripts/dev.sh
# Runs on http://localhost:3001
```

**Terminal 2 (Frontend):**

```bash
# From project root
npm install
npm run dev
# Runs on http://localhost:5173
```

Visit `http://localhost:5173` in your browser.

## Data Migration

If you have existing Parquet data files in the `data/` directory from previous versions:

```bash
# From project root (with backend venv activated)
export PYTHONPATH=$PYTHONPATH:.
python3 backend/scripts/migrate_parquet.py
```

## API Documentation

Once the backend is running, full API documentation (Swagger UI) is available at:
`http://localhost:3001/docs`

## Usage Guide

1.  **Import Data**: Go to Dashboard > Import CSV. Upload your broker export file.
2.  **View Portfolio**: The dashboard automatically updates with total value, cost, and P/L.
3.  **Prices**: Stock prices are automatically fetched from Yahoo Finance.

## Development

### Backend Structure

```
backend/app/
├── core/             # Domain Entities & Port Interfaces
├── infrastructure/   # Adapters (DB, External APIs)
├── services/         # Application Services
└── api/              # Presentation (FastAPI Endpoints)
```

### Frontend Structure

```
src/
├── domain/           # Pure Domain Logic (Models, Calculators, Ports)
├── application/      # Application Services (Use Cases, Store)
├── infrastructure/   # Infrastructure Adapters (API Client, Repositories)
└── presentation/     # Presentation Layer (Components, Pages, Hooks)
```

## Troubleshooting

**Backend won't start**

- Ensure Python 3.10+ is installed.
- Check virtual environment activation.
- Verify `backend/requirements.txt` packages are installed.

**Frontend "Network Error"**

- Ensure the Backend server is running on port 3001.
- Check browser console for CORS errors (CORS is configured for localhost:5173).

## License

MIT

## Disclaimer

This software is provided "as-is" for personal use. Not financial or tax advice.
Always verify P/L calculations against official broker statements.
