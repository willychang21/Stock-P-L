# Stock P:L — Investment Portfolio Tracker

A full-stack web application for personal investment tracking and P/L analysis.

![Demo Screen Placeholder](./.github/assets/demo.png) _(Note: Please update with actual screenshot)_

## What This Does

This application provides a comprehensive dashboard to track your investment portfolio's performance. You can import trade history (CSV) from your broker, and the app will automatically calculate your Realized and Unrealized Profit/Loss.

I built this because I wanted a **privacy-focused** alternative to cloud-based financial trackers. All transaction data is stored locally on your machine (via DuckDB), and live stock prices are fetched automatically via a proxy to Yahoo Finance, requiring no manual entry or third-party cloud syncing.

## Tech Stack

- **Backend**: Python 3.10+, FastAPI, DuckDB, Pydantic, `yfinance`
  - _Why_: FastAPI provides robust typing and async endpoints, while DuckDB is perfect for fast, in-process analytical queries without needing a separate database server.
- **Frontend**: React 18, TypeScript, Vite, Material UI (MUI 5), TailwindCSS 3, Zustand, Recharts
  - _Why_: A modern React stack with Vite offers a fantastic developer experience. Zustand keeps state management minimal, and Recharts makes data visualization simple and beautiful.

## Getting Started

### Prerequisites

- **Python 3.10+** (for backend)
- **Node.js 18+** (for frontend)

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

You need to run both the backend and frontend servers in separate terminals.

**Terminal 1 (Backend):**

```bash
# From project root
./backend/scripts/dev.sh
# Runs on http://localhost:3001
```

**Terminal 2 (Frontend):**

```bash
# From project root
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

Visit `http://localhost:5173` in your browser.

## How It Works

This application follows a **Strict Layered (Hexagonal) Architecture** on both the frontend and backend to ensure maintainability, extensibility, and testability.

### Key Design Patterns

- **Strategy Pattern**: Decoupled portfolio calculators (FIFO, Weighted Average) that can be swapped dynamically.
- **Repository Pattern**: Abstracted data access to isolate domain logic from storage specifics (DuckDB/LocalStorage).
- **Result Pattern**: Standardized error handling mechanism across the stack.

### Architecture Structure

- **Domain Layer**: Pure business logic (Entities, Value Objects, Port Interfaces). No external dependencies.
- **Application Layer**: Orchestrates domain logic via Services (Use Cases).
- **Infrastructure Layer**: Implementation of port interfaces (API clients, Database repositories, Market data adapters).
- **Presentation Layer**: UI Components (React) and API Endpoints (FastAPI).

## What I Learned

- Implementing **Hexagonal Architecture** consistently across two entirely different ecosystems (Python/FastAPI and TypeScript/React), enforcing strict boundaries between pure business logic and infrastructure.
- Leveraging **DuckDB** as an embedded analytical database, demonstrating its incredible speed and efficiency for local data manipulation and aggregations instead of a traditional RDBMS.
- Creating clean abstractions like the **Repository and Strategy patterns** to keep complex financial calculation logic modular and testable.

## Future Ideas

- [ ] Complete the FIFO (First-In-First-Out) cost basis calculation service
- [ ] Add parsing support for exporting CSVs from additional brokers
- [ ] Enhance visualizations with advanced portfolio risk metrics (e.g., Sharpe Ratio, asset allocation breakdowns)

## API Documentation

Once the backend is running, full API documentation (Swagger UI) is available at:
`http://localhost:3001/docs`

## Data Migration

If you have existing Parquet data files in the `data/` directory from previous versions:

```bash
# From project root (with backend venv activated)
export PYTHONPATH=$PYTHONPATH:.
python3 backend/scripts/migrate_parquet.py
```

## Troubleshooting

- **Backend won't start**: Ensure Python 3.10+ is installed and your virtual environment is activated before installing `backend/requirements.txt`.
- **Frontend "Network Error"**: Make sure the backend server runs on port 3001 and CORS issues aren't blocking queries in the browser console.

## License

MIT

## Disclaimer

This software is provided "as-is" for personal use. Not financial or tax advice. Always verify P/L calculations against official broker statements.
