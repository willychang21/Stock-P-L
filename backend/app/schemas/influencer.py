from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime

class InfluencerBase(BaseModel):
    name: str
    platform: Optional[str] = None
    url: Optional[str] = None

class InfluencerCreate(InfluencerBase):
    pass

class Influencer(InfluencerBase):
    id: str
    created_at: datetime

class RecommendationBase(BaseModel):
    symbol: str
    recommendation_date: date
    initial_price: Optional[float] = None
    note: Optional[str] = None

class RecommendationCreate(RecommendationBase):
    pass

class Recommendation(RecommendationBase):
    id: str
    influencer_id: str
    created_at: datetime
    # Calculated fields
    current_price: Optional[float] = None
    price_change_percent: Optional[float] = None

class InfluencerUpdate(BaseModel):
    name: Optional[str] = None
    platform: Optional[str] = None
    url: Optional[str] = None

class RecommendationUpdate(BaseModel):
    symbol: Optional[str] = None
    recommendation_date: Optional[date] = None
    initial_price: Optional[float] = None
    note: Optional[str] = None

class InfluencerWithStats(Influencer):
    recommendation_count: int = 0
    avg_return: Optional[float] = None
