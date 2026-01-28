from pydantic import BaseModel, Field
from typing import Optional, Any
from enum import Enum
from datetime import date, datetime
import uuid

class TransactionType(str, Enum):
    BUY = "BUY"
    SELL = "SELL"
    DIVIDEND = "DIVIDEND"
    INTEREST = "INTEREST"
    TRANSFER = "TRANSFER"
    FEE = "FEE"
    # Add other types as needed

class ImportBatchBase(BaseModel):
    broker: str
    filename: str
    imported_at: datetime
    row_count: int

class ImportBatch(ImportBatchBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))

class TransactionBase(BaseModel):
    import_batch_id: str
    symbol: str
    transaction_type: str
    transaction_date: date
    settle_date: Optional[date] = None
    quantity: float
    price: float
    fees: float
    total_amount: float
    broker: str
    account_id: Optional[str] = None
    notes: Optional[str] = None
    raw_data: str # Storing JSON string or CSV row content
    content_hash: str

class Transaction(TransactionBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.now)
