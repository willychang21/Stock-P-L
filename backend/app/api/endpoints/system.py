from fastapi import APIRouter, Depends
import duckdb
from app.db.session import get_db

router = APIRouter()

@router.get("/stats")
def get_stats(conn: duckdb.DuckDBPyConnection = Depends(get_db)):
    tx_count = conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0]
    batch_count = conn.execute("SELECT COUNT(*) FROM import_batches").fetchone()[0]
    return {
        "transaction_count": tx_count,
        "batch_count": batch_count
    }

@router.delete("/reset")
def reset_database(conn: duckdb.DuckDBPyConnection = Depends(get_db)):
    conn.execute("DELETE FROM transactions")
    conn.execute("DELETE FROM import_batches")
    conn.execute("DELETE FROM prices")
    return {"status": "success", "message": "Database cleared"}
