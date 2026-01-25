import sys
import os
from pathlib import Path

sys.path.append(str(Path(__file__).parent))

try:
    from app.db.session import db
    from app.schemas.portfolio import TransactionResponse
    from pydantic import ValidationError
    import json

    conn = db.get_connection()
    query = "SELECT * FROM transactions LIMIT 10"
    cursor = conn.execute(query)
    cols = [desc[0] for desc in cursor.description]
    rows = cursor.fetchall()
    
    print(f"Found {len(rows)} rows in database.")
    
    for row in rows:
        row_dict = dict(zip(cols, row))
        print(f"\nProcessing row ID: {row_dict.get('id')}")
        
        mapped = {
            "id": str(row_dict.get("id", "")),
            "date": row_dict.get("transaction_date") or row_dict.get("date"),
            "symbol": row_dict.get("symbol", "UNKNOWN"),
            "type": row_dict.get("transaction_type") or row_dict.get("type", "BUY"),
            "quantity": row_dict.get("quantity", 0),
            "price": row_dict.get("price", 0),
            "fees": row_dict.get("fees", 0),
            "currency": row_dict.get("currency", "USD"),
            "broker": row_dict.get("broker", "UNKNOWN"),
            "rawData": row_dict.get("raw_data"),
            "notes": row_dict.get("notes")
        }
        
        try:
            # Manually trigger Pydantic validation
            obj = TransactionResponse(**mapped)
            print(f"✓ Validation passed for {mapped['symbol']} {mapped['type']}")
        except ValidationError as ve:
            print(f"✗ Validation FAILED for {mapped['symbol']}")
            print(f"  Mapped data: {mapped}")
            print(f"  Errors: {ve.json()}")

except Exception as e:
    import traceback
    traceback.print_exc()
