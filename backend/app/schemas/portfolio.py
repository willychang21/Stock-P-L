from __future__ import annotations
from pydantic import BaseModel
from typing import List, Optional
from datetime import date
from app.core.domain.models import Transaction as DomainTransaction

class PortfolioSummary(BaseModel):
    total_value: float
    total_cost: float
    total_pl: float
    total_pl_percent: float
    total_realized_pl: float
    total_unrealized_pl: float

class TransactionResponse(DomainTransaction):
    # Add optional fields that might be in the database but not core domain
    broker: str | None = None
    rawData: str | None = None
    notes: str | None = None

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
