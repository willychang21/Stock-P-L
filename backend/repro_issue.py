
from app.models.transaction import Transaction, TransactionType
from datetime import datetime
import pandas as pd
import numpy as np
import traceback

def test():
    print("Testing Transaction Instantiation with NULLs/Numpy...")
    
    try:
        # Simulate values from importer
        batch_id = "test-batch"
        symbol = "AAPL"
        tx_type = TransactionType.BUY
        tx_date = datetime.now().date()
        
        # Test 1: numpy float64
        quantity = np.float64(10.5)
        price = np.float64(150.0)
        fees = 0.0
        amount = 1575.0
        
        print(f"NumPy Float64 Test: Qty Type: {type(quantity)}")
        
        tx = Transaction(
            import_batch_id=batch_id,
            symbol=symbol,
            transaction_type=tx_type,
            transaction_date=tx_date,
            quantity=quantity,
            price=price,
            fees=fees,
            total_amount=amount, 
            broker="ROBINHOOD",
            raw_data="{}",
            content_hash="abc"
        )
        print("Success with NumPy float64!")

        # Test 2: NaN
        print("Testing NaN quantity...")
        quantity_nan = float('nan')
        try:
             Transaction(
                import_batch_id=batch_id,
                symbol=symbol,
                transaction_type=tx_type,
                transaction_date=tx_date,
                quantity=quantity_nan,
                price=price,
                fees=fees,
                total_amount=amount, 
                broker="ROBINHOOD",
                raw_data="{}",
                content_hash="abc_nan"
            )
             print("Success with NaN!")
        except Exception as e:
            print(f"Failed with NaN: {e}")

        # Test 3: Float Timestamp for Date
        print("Testing Float Timestamp for Date...")
        try:
             Transaction(
                import_batch_id=batch_id,
                symbol=symbol,
                transaction_type=tx_type,
                transaction_date=1706054400.0, # Float timestamp
                quantity=1,
                price=1,
                fees=0,
                total_amount=1, 
                broker="ROBINHOOD",
                raw_data="{}",
                content_hash="abc_ts"
            )
             print("Success with Float Timestamp!")
        except Exception as e:
            # traceback.print_exc()
            print(f"Failed with Float Timestamp: {e}")

        # Test 4: NaN for Date (Expecting Error)
        print("Testing NaN for Date...")
        try:
             Transaction(
                import_batch_id=batch_id,
                symbol=symbol,
                transaction_type=tx_type,
                transaction_date=float('nan'),
                quantity=1,
                price=1,
                fees=0,
                total_amount=1, 
                broker="ROBINHOOD",
                raw_data="{}",
                content_hash="abc_date_nan"
            )
             print("Sucess with NaN Date!")
        except Exception:
            # This is EXPECTED to fail differently?
            traceback.print_exc()
        
    except Exception:
        traceback.print_exc()

if __name__ == "__main__":
    test()
