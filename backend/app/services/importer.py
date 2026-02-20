from __future__ import annotations
import pandas as pd
import io
import hashlib
import uuid
from datetime import datetime, date
from app.models.transaction import Transaction, ImportBatch, TransactionType
from app.db.session import db
from typing import List, Tuple, Any

class ImporterService:
    def _clean_currency(self, val: Any) -> float:
        if pd.isna(val) or val == '':
            return 0.0
        s = str(val).strip()
        s = s.replace('$', '').replace(',', '')
        if '(' in s and ')' in s:
            s = s.replace('(', '').replace(')', '')
            return -float(s)
        try:
            return float(s)
        except:
            return 0.0

    def _clean_number(self, val: Any) -> float:
        if pd.isna(val) or val == '':
            return 0.0
        s = str(val).strip().replace(',', '')
        try:
            return float(s)
        except:
            return 0.0

    def parse_csv(self, file_content: bytes, filename: str, broker: str) -> Tuple[ImportBatch, List[Transaction]]:
        try:
            text = file_content.decode('utf-8', errors='ignore')
            
            # Pre-screening for Schwab "Realized" or "as of" lines often used in headers
            lines = text.split('\n')
            skip_rows = 0
            if len(lines) > 0 and ("Realized" in lines[0] or "as of" in lines[0].lower()):
                skip_rows = 1
                
            # Read CSV
            # on_bad_lines='skip' helps with footers that have too many/few columns
            try:
                df = pd.read_csv(io.StringIO(text), skiprows=skip_rows, on_bad_lines='skip')
            except pd.errors.EmptyDataError:
                # Handle empty file
                df = pd.DataFrame()

            # Normalize Columns for easier access
            df.columns = df.columns.astype(str).str.strip().str.replace('"', '')
            
            transactions = []
            batch_id = str(uuid.uuid4())
            import_batch = ImportBatch(
                id=batch_id,
                broker=broker,
                filename=filename,
                imported_at=datetime.now(),
                row_count=len(df)
            )
            
            for _, row in df.iterrows():
                # --- Robinhood Logic ---
                if 'Activity Date' in df.columns and 'Instrument' in df.columns:
                     # Filter out non-trade rows effectively
                    trans_code = str(row.get('Trans Code', '')).upper()
                    description = str(row.get('Description', ''))
                    
                    symbol = str(row.get('Instrument', ''))
                    if pd.isna(symbol) or symbol == 'nan' or symbol == '':
                         symbol = 'CASH' 
                    
                    date_str = str(row.get('Activity Date', ''))
                    
                    action_raw = str(row.get('Trans Code', '')).upper()
                    # Map Robinhood Trans Codes
                    if action_raw == 'BUY': tx_type = TransactionType.BUY
                    elif action_raw == 'SELL': tx_type = TransactionType.SELL
                    elif action_raw in ['CDIV', 'DIV']: tx_type = TransactionType.DIVIDEND
                    elif action_raw == 'INT': tx_type = TransactionType.INTEREST
                    elif action_raw in ['ACH', 'RTP', 'CFRI', 'CFIR', 'MTCH']: tx_type = TransactionType.TRANSFER
                    elif action_raw in ['GOLD', 'DTAX']: tx_type = TransactionType.FEE
                    else: tx_type = TransactionType.TRANSFER # Default/Other
                    
                    quantity = self._clean_number(row.get('Quantity'))
                    price = self._clean_currency(row.get('Price'))
                    amount = self._clean_currency(row.get('Amount'))
                    
                    # Fix for Robinhood Transfers where Quantity/Price are 0 but Amount has value
                    if quantity == 0.0 and price == 0.0 and amount != 0.0:
                        price = amount
                        
                    fees = 0.0 
                    
                # --- Schwab Logic ---
                elif 'Action' in df.columns and ('Symbol' in df.columns or 'Ticker' in df.columns):
                    symbol = str(row.get('Symbol', ''))
                    action_raw = str(row.get('Action', '')).lower()
                    
                    # Handle Cash Actions (Journal, Bank Interest, etc) -> Symbol USD
                    is_cash_action = any(k in action_raw for k in ['journal', 'bank interest', 'wire', 'transfer', 'ach', 'deposit', 'withdrawal'])
                    if (pd.isna(symbol) or symbol == 'nan' or symbol == '') and is_cash_action:
                         symbol = 'USD'
                    
                    if pd.isna(symbol) or symbol == 'nan' or symbol == '':
                         # If still empty and not cash action, likely junk row
                         # But let's verify if Reinvest?
                         pass 
                         
                    date_val = str(row.get('Date', ''))
                    if ' as of ' in date_val:
                        date_str = date_val.split(' as of ')[0]
                    else:
                        date_str = date_val
                        
                    if 'buy' in action_raw or 'reinvest shares' in action_raw: tx_type = TransactionType.BUY
                    elif 'sell' in action_raw: tx_type = TransactionType.SELL
                    elif 'dividend' in action_raw or 'reinvest dividend' in action_raw: tx_type = TransactionType.DIVIDEND
                    elif 'interest' in action_raw: tx_type = TransactionType.INTEREST
                    elif 'journal' in action_raw or 'deposit' in action_raw: tx_type = TransactionType.TRANSFER
                    else: tx_type = TransactionType.TRANSFER
                    
                    quantity = self._clean_number(row.get('Quantity'))
                    price = self._clean_currency(row.get('Price'))
                    
                    fees_col = next((c for c in df.columns if 'Fees' in c), None)
                    fees = self._clean_currency(row.get(fees_col)) if fees_col else 0.0
                    
                    amount = self._clean_currency(row.get('Amount'))
                    
                    # Fallback Price from Amount for Cash actions if Price is 0
                    if tx_type in [TransactionType.DIVIDEND, TransactionType.INTEREST, TransactionType.TRANSFER, TransactionType.FEE]:
                        if price == 0.0 and amount != 0.0:
                            if tx_type == TransactionType.FEE:
                                price = abs(amount) # Fees are magnitude
                            else:
                                price = amount # Keep sign for Transfer/Interest

                # --- Generic/Fallback Logic ---
                else:
                    symbol = str(row.get('Symbol', 'UNKNOWN'))
                    date_str = str(row.get('Date', '')) or str(row.get('TradeDate', ''))
                    tx_type = TransactionType.BUY # Default
                    action = str(row.get('Action', '')).upper()
                    if 'SELL' in action: tx_type = TransactionType.SELL
                    
                    quantity = self._clean_number(row.get('Quantity'))
                    price = self._clean_currency(row.get('Price'))
                    amount = self._clean_currency(row.get('Amount'))
                    fees = self._clean_currency(row.get('Fees'))

                # --- Common Post-Processing ---
                tx_date = datetime.now().date()
                try:
                    parsed = pd.to_datetime(date_str)
                    if not pd.isna(parsed):
                        tx_date = parsed.date()
                except:
                    pass
                
                # Create Content Hash
                raw_json = row.to_json()
                content_hash = hashlib.md5(raw_json.encode()).hexdigest()
                
                # Explicitly cast to Python types to avoid Pydantic/Numpy issues
                safe_qty = float(quantity) if quantity is not None else 0.0
                safe_price = float(price) if price is not None else 0.0
                safe_fees = float(fees) if fees is not None else 0.0
                safe_amount = float(amount) if amount is not None else 0.0
                
                # Ensure date is strictly a python date object
                if isinstance(tx_date, datetime):
                    safe_date = tx_date.date()
                else:
                    safe_date = tx_date

                try:
                    tx = Transaction(
                        import_batch_id=str(batch_id),
                        symbol=str(symbol),
                        transaction_type=tx_type,
                        transaction_date=safe_date,
                        quantity=abs(safe_qty),
                        # Allow signed price for Transfers/Interest to support cash flow direction if needed
                        # But standard is abs(price) and using TransactionType to infer direction?
                        # Wait, Calculator uses Price * Qty. 
                        # For Cash Transactions where Q=0, we put Amount into Price.
                        # IF we enforce abs(safe_price) here, we LOSE the negative sign from 'Journal' withdrawals!
                        # We must preserve sign for Price IF it's a Transfer/Interest/Dividend where we used Amount as Price.
                        price=safe_price if abs(safe_qty) < 0.000001 else abs(safe_price),
                        fees=abs(safe_fees),
                        total_amount=safe_amount, 
                        broker=str(broker),
                        raw_data=str(raw_json),
                        content_hash=str(content_hash)
                    )
                    transactions.append(tx)
                except Exception as inner_e:
                    print(f"Skipping malformed row: {inner_e}")
                    # traceback.print_exc()
                    continue
                
            return import_batch, transactions
            
        except Exception as e:
            import traceback
            tb = traceback.format_exc()
            print(tb)
            raise ValueError(f"Failed to parse CSV: {str(e)}")

    def save_import(self, batch: ImportBatch, transactions: List[Transaction]):
        conn = db.get_connection()
        try:
            conn.execute("BEGIN TRANSACTION")
            
            # Save Batch
            conn.execute("""
                INSERT INTO import_batches (id, broker, filename, imported_at, row_count)
                VALUES (?, ?, ?, ?, ?)
            """, [batch.id, batch.broker, batch.filename, batch.imported_at, batch.row_count])
            
            # Save Transactions
            tx_data = []
            for tx in transactions:
                tx_data.append(
                    (
                        tx.id, tx.import_batch_id, tx.symbol, tx.transaction_type, 
                        tx.transaction_date, tx.settle_date, tx.quantity, tx.price, 
                        tx.fees, tx.total_amount, tx.broker, tx.account_id, tx.notes, 
                        tx.created_at, tx.raw_data, tx.content_hash
                    )
                )
            
            if tx_data:
                conn.executemany("""
                    INSERT OR IGNORE INTO transactions (
                        id, import_batch_id, symbol, transaction_type, transaction_date, 
                        settle_date, quantity, price, fees, total_amount, broker, 
                        account_id, notes, created_at, raw_data, content_hash
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, tx_data)
            
            conn.execute("COMMIT")
        except Exception as e:
            conn.execute("ROLLBACK")
            raise e
        finally:
            conn.close()

importer_service = ImporterService()