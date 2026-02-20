from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
from enum import Enum

# Enums for structured data
class SignalType(str, Enum):
    BUY = "BUY"
    SELL = "SELL"
    HOLD = "HOLD"       # Legacy — mapped to WATCH in new prompts
    HEDGE = "HEDGE"
    WATCH = "WATCH"
    CLOSED = "CLOSED"

class TimeframeType(str, Enum):
    SHORT = "SHORT"   # < 1 week
    MID = "MID"       # 1-4 weeks
    LONG = "LONG"     # > 1 month

class SourceType(str, Enum):
    MANUAL = "MANUAL"
    AUTO_THREADS = "AUTO_THREADS"
    AUTO_SUBSTACK = "AUTO_SUBSTACK"

class RecommendationStatus(str, Enum):
    PENDING = "PENDING"    # Awaiting user review (auto-tracked only)
    ACTIVE = "ACTIVE"      # Currently being tracked
    EXPIRED = "EXPIRED"    # Past expiry date
    CLOSED = "CLOSED"      # Manually closed by user

# Influencer models
class InfluencerBase(BaseModel):
    name: str
    platform: Optional[str] = None
    url: Optional[str] = None

class InfluencerCreate(InfluencerBase):
    pass

class Influencer(InfluencerBase):
    id: str
    created_at: datetime

class InfluencerUpdate(BaseModel):
    name: Optional[str] = None
    platform: Optional[str] = None
    url: Optional[str] = None

# Enhanced Recommendation models
class RecommendationBase(BaseModel):
    symbol: str
    signal: SignalType = SignalType.BUY
    timeframe: TimeframeType = TimeframeType.MID
    recommendation_date: date
    entry_price: Optional[float] = None
    target_price: Optional[float] = None
    stop_loss: Optional[float] = None
    expiry_date: Optional[date] = None
    source_url: Optional[str] = None
    note: Optional[str] = None

class RecommendationCreate(RecommendationBase):
    source: SourceType = SourceType.MANUAL

class Recommendation(RecommendationBase):
    id: str
    influencer_id: str
    source: Optional[str] = None  # str instead of enum to tolerate legacy data
    status: RecommendationStatus = RecommendationStatus.ACTIVE
    created_at: datetime
    # Calculated fields (populated by backend)
    current_price: Optional[float] = None
    unrealized_return: Optional[float] = None
    final_return: Optional[float] = None
    hit_target: Optional[bool] = None
    hit_stop_loss: Optional[bool] = None

class RecommendationUpdate(BaseModel):
    symbol: Optional[str] = None
    signal: Optional[SignalType] = None
    timeframe: Optional[TimeframeType] = None
    recommendation_date: Optional[date] = None
    entry_price: Optional[float] = None
    target_price: Optional[float] = None
    stop_loss: Optional[float] = None
    expiry_date: Optional[date] = None
    source: Optional[SourceType] = None
    source_url: Optional[str] = None
    note: Optional[str] = None
    status: Optional[RecommendationStatus] = None

# Stats models for performance tracking
class InfluencerWithStats(Influencer):
    recommendation_count: int = 0
    active_count: int = 0
    expired_count: int = 0
    win_rate: Optional[float] = None  # % of expired recommendations with positive return
    avg_return: Optional[float] = None
    hit_target_rate: Optional[float] = None

class InfluencerPerformance(BaseModel):
    """Detailed performance breakdown by timeframe"""
    influencer_id: str
    name: str
    short_term: Optional[dict] = None  # {count, win_rate, avg_return}
    mid_term: Optional[dict] = None
    long_term: Optional[dict] = None
    overall: Optional[dict] = None

# Pending review model for auto-tracked recommendations
class PendingReview(BaseModel):
    id: str
    influencer_id: str
    influencer_name: str
    source: Optional[str] = None
    source_url: str
    original_content: str
    ai_analysis: dict  # Raw AI output
    suggested_symbol: Optional[str] = None
    suggested_signal: Optional[SignalType] = None
    suggested_timeframe: Optional[TimeframeType] = None
    confidence: Optional[float] = None
    post_date: Optional[date] = None
    created_at: datetime
