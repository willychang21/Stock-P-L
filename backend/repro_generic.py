import pandas as pd
import sys
import os
from datetime import date

sys.path.append(os.getcwd())
from backend.app.models.transaction import Transaction, TransactionType

# Force Generic path simulation
try:
    print("Testing Transaction instantiation...")
    tx = Transaction(
        import_batch_id='123',
        symbol='UNKNOWN',
        transaction_type=TransactionType.BUY,
        transaction_date=date.today(),
        quantity=0.0,
        price=0.0,
        fees=0.0,
        total_amount=0.0,
        broker='ROBINHOOD',
        raw_data='{}',
        content_hash='abc'
    )
    print("Success:", tx)
except Exception as e:
    print(f"Failed: {e}")
    import traceback
    traceback.print_exc()
