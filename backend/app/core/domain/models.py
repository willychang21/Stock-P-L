from __future__ import annotations
from enum import Enum
from pydantic import BaseModel, Field
from typing import List, Union
from datetime import datetime, date
from decimal import Decimal

class TransactionType(str, Enum):
    BUY = 'BUY'
    SELL = 'SELL'
    DIVIDEND = 'DIVIDEND'
    SPLIT = 'SPLIT'
    FEE = 'FEE'
    TRANSFER = 'TRANSFER'
    INTEREST = 'INTEREST'

class Transaction(BaseModel):
    id: str
    date: Union[datetime, date]
    symbol: str
    type: TransactionType
    quantity: Decimal
    price: Decimal
    fees: Decimal
    currency: str = "USD"
    total_amount: Decimal = Decimal(0)

class Holding(BaseModel):
    symbol: str
    quantity: Decimal
    average_cost: Decimal
    current_price: Decimal
    market_value: Decimal
    unrealized_pl: Decimal
    realized_pl: Decimal
    asset_type: str = "EQUITY"

class Portfolio(BaseModel):
    holdings: List[Holding]
    total_market_value: Decimal
    total_unrealized_pl: Decimal
    total_realized_pl: Decimal
    cash_balance: Decimal

class AnalysisResult(BaseModel):
    calculator_id: str
    metrics: dict
    generated_at: datetime
