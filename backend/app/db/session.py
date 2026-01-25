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
        self._conn = None

    def get_connection(self):
        """
        Get a singleton connection to the DuckDB database.
        DuckDB supports multiple threads using the same connection object
        by creating child cursors.
        """
        if self._conn is None:
            # Open the connection once
            self._conn = duckdb.connect(self.db_path)
        
        # Return a cursor (thread-safe way to use a shared connection)
        return self._conn.cursor()

db = Database(DB_PATH)

def get_db():
    """Dependency for FastAPI endpoints"""
    # Note: cursors in DuckDB don't need explicit closing in the same way connections do,
    # but we follow the pattern for consistency.
    cursor = db.get_connection()
    try:
        yield cursor
    finally:
        # Cursor close is optional but good practice
        pass
