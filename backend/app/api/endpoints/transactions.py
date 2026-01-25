from fastapi import APIRouter, Depends, Query, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from app.schemas.portfolio import TransactionResponse
from app.db.session import get_db
import duckdb
from decimal import Decimal
from app.core.domain.models import TransactionType

router = APIRouter()

class UpdateTransactionRequest(BaseModel):
    notes: Optional[str] = None

from app.core.domain.models import TransactionType

@router.get("", response_model=List[TransactionResponse])
def list_transactions(
    limit: int = 100000,
    offset: int = 0,
    conn: duckdb.DuckDBPyConnection = Depends(get_db)
):
    query = "SELECT * FROM transactions ORDER BY transaction_date DESC, id ASC LIMIT ? OFFSET ?"
    cursor = conn.execute(query, [limit, offset])
    cols = [desc[0] for desc in cursor.description]
    rows = cursor.fetchall()
    
    results = []
    for row in rows:
        row_dict = dict(zip(cols, row))
        
        # 1. Determine transaction type safely
        raw_type = row_dict.get("transaction_type") or row_dict.get("type", "BUY")
        try:
            tx_type = TransactionType(raw_type)
        except ValueError:
            tx_type = TransactionType.FEE
            
        # 2. Handle Date conversion strictly
        raw_date = row_dict.get("transaction_date") or row_dict.get("date")
        if not raw_date:
            continue
            
        # Convert date/datetime to ISO string
        if hasattr(raw_date, "isoformat"):
            tx_date_str = raw_date.isoformat()
        else:
            tx_date_str = str(raw_date)
            
        # 3. Ensure numerical values are serialized correctly
        try:
            mapped = {
                "id": str(row_dict.get("id", "")),
                "date": tx_date_str,
                "symbol": str(row_dict.get("symbol", "UNKNOWN")),
                "type": tx_type,
                "quantity": float(str(row_dict.get("quantity", 0))),
                "price": float(str(row_dict.get("price", 0))),
                "fees": float(str(row_dict.get("fees", 0))),
                "currency": str(row_dict.get("currency", "USD")),
                "broker": str(row_dict.get("broker", "UNKNOWN")),
                "rawData": row_dict.get("raw_data"),
                "notes": row_dict.get("notes")
            }
            results.append(mapped)
        except Exception as e:
            print(f"Skipping row due to error: {e}")
            continue
    
    return results

@router.patch("/{transaction_id}")
def update_transaction(
    transaction_id: str,
    request: UpdateTransactionRequest,
    conn: duckdb.DuckDBPyConnection = Depends(get_db)
):
    if request.notes is not None:
        conn.execute("UPDATE transactions SET notes = ? WHERE id = ?", [request.notes, transaction_id])
    return {"status": "success"}

@router.delete("/{transaction_id}")
def delete_transaction(
    transaction_id: str,
    conn: duckdb.DuckDBPyConnection = Depends(get_db)
):
    conn.execute("DELETE FROM transactions WHERE id = ?", [transaction_id])
    return {"status": "success"}
