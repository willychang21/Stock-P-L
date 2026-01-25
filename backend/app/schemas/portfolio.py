from pydantic import BaseModel
from typing import List, Optional
from datetime import date
from app.models.transaction import Transaction

class PortfolioSummary(BaseModel):
    total_value: float
    total_cost: float
    total_pl: float
    total_pl_percent: float
    total_realized_pl: float
    total_unrealized_pl: float

class TransactionResponse(Transaction):
    pass

class TransactionList(BaseModel):
    items: List[TransactionResponse]
    total: int
    limit: int
    offset: int

class ImportResult(BaseModel):
    success: bool
    count: int
    batch_id: str
    message: str
