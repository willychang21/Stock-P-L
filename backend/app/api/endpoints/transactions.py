from fastapi import APIRouter, Depends, Query
from typing import List
from app.schemas.portfolio import TransactionResponse
from app.db.session import get_db
import duckdb

router = APIRouter()

@router.get("/", response_model=List[TransactionResponse])
def list_transactions(
    limit: int = 100000,
    offset: int = 0,
    conn: duckdb.DuckDBPyConnection = Depends(get_db)
):
    query = "SELECT * FROM transactions ORDER BY transaction_date ASC, id ASC LIMIT ? OFFSET ?"
    # Use native fetchall and map to dicts to avoid extra dependencies
    cursor = conn.execute(query, [limit, offset])
    cols = [desc[0] for desc in cursor.description]
    rows = cursor.fetchall()
    
    return [dict(zip(cols, row)) for row in rows]
