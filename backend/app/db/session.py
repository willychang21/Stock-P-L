import duckdb
import os
from contextlib import contextmanager

# Define database path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "portfolio.duckdb")

# Ensure data directory exists
os.makedirs(DATA_DIR, exist_ok=True)

class Database:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._connection = None

    def get_connection(self):
        """
        Get a connection to the DuckDB database.
        DuckDB Python client is not thread-safe for sharing a single connection across threads,
        but using `duckdb.connect()` creates a new connection each time.
        For read-only concurrency, separate cursors are fine.
        For persistent storage, we connect to the file.
        """
        # In a real high-concurrency app, we might want a connection pool or cursor management.
        # For this local app, creating a connection per request is acceptable for DuckDB.
        conn = duckdb.connect(self.db_path)
        return conn

db = Database(DB_PATH)

def get_db():
    """Dependency for FastAPI endpoints"""
    conn = db.get_connection()
    try:
        yield conn
    finally:
        conn.close()
