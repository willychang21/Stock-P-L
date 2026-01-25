import pandas as pd
import io
import sys
import os
import datetime

sys.path.append(os.getcwd())
from backend.app.services.importer import importer_service

# Date as a float (Excel serial date)
csv_content = """Activity Date,Process Date,Settle Date,Instrument,Description,Trans Code,Quantity,Price,Amount
45315.0,45315.0,45317.0,AAPL,Bought 10 AAPL,Buy,10,$150.00,$1500.00
"""

try:
    print("Parsing Float Date CSV...")
    batch, txs = importer_service.parse_csv(csv_content.encode('utf-8'), "float_date.csv", "ROBINHOOD")
    print(f"Parsed {len(txs)} transactions.")
    print(txs[0].transaction_date)
except Exception as e:
    print(f"Caught Exception: {e}")
