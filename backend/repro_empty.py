import pandas as pd
import io
import sys
import os

sys.path.append(os.getcwd())
from backend.app.services.importer import importer_service

csv_content = ""

try:
    print("Parsing Empty CSV...")
    batch, txs = importer_service.parse_csv(csv_content.encode('utf-8'), "empty.csv", "ROBINHOOD")
    print(f"Parsed {len(txs)} transactions.")
except Exception as e:
    print(f"Caught Exception: {e}")
    import traceback
    traceback.print_exc()
