from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class PriceBase(BaseModel):
    symbol: str
    price: float
    change: float
    change_percent: float
    quote_type: Optional[str] = None

class Price(PriceBase):
    updated_at: datetime = Field(default_factory=datetime.now)
