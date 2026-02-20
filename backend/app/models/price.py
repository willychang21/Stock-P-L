from __future__ import annotations
from pydantic import BaseModel, Field

from datetime import datetime

class PriceBase(BaseModel):
    symbol: str
    price: float
    change: float
    change_percent: float
    quote_type: str | None = None

class Price(PriceBase):
    updated_at: datetime = Field(default_factory=datetime.now)
