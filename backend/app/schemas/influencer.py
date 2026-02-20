from __future__ import annotations
from pydantic import BaseModel
from typing import List
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
    platform: str | None = None
    url: str | None = None

class InfluencerCreate(InfluencerBase):
    pass

class Influencer(InfluencerBase):
    id: str
    created_at: datetime

class InfluencerUpdate(BaseModel):
    name: str | None = None
    platform: str | None = None
    url: str | None = None

# Enhanced Recommendation models
class RecommendationBase(BaseModel):
    symbol: str
    signal: SignalType = SignalType.BUY
    timeframe: TimeframeType = TimeframeType.MID
    recommendation_date: date
    entry_price: float | None = None
    target_price: float | None = None
    stop_loss: float | None = None
    expiry_date: date | None = None
    source_url: str | None = None
    note: str | None = None

class RecommendationCreate(RecommendationBase):
    source: SourceType = SourceType.MANUAL

class Recommendation(RecommendationBase):
    id: str
    influencer_id: str
    source: str | None = None  # str instead of enum to tolerate legacy data
    status: RecommendationStatus = RecommendationStatus.ACTIVE
    created_at: datetime
    # Calculated fields (populated by backend)
    current_price: float | None = None
    unrealized_return: float | None = None
    final_return: float | None = None
    hit_target: bool | None = None
    hit_stop_loss: bool | None = None

class RecommendationUpdate(BaseModel):
    symbol: str | None = None
    signal: SignalType | None = None
    timeframe: TimeframeType | None = None
    recommendation_date: date | None = None
    entry_price: float | None = None
    target_price: float | None = None
    stop_loss: float | None = None
    expiry_date: date | None = None
    source: SourceType | None = None
    source_url: str | None = None
    note: str | None = None
    status: RecommendationStatus | None = None

# Stats models for performance tracking
class InfluencerWithStats(Influencer):
    recommendation_count: int = 0
    active_count: int = 0
    expired_count: int = 0
    win_rate: float | None = None  # % of expired recommendations with positive return
    avg_return: float | None = None
    hit_target_rate: float | None = None

class InfluencerPerformance(BaseModel):
    """Detailed performance breakdown by timeframe"""
    influencer_id: str
    name: str
    short_term: dict | None = None  # {count, win_rate, avg_return}
    mid_term: dict | None = None
    long_term: dict | None = None
    overall: dict | None = None

# Pending review model for auto-tracked recommendations
class PendingReview(BaseModel):
    id: str
    influencer_id: str
    influencer_name: str
    source: str | None = None
    source_url: str
    original_content: str
    ai_analysis: dict  # Raw AI output
    suggested_symbol: str | None = None
    suggested_signal: SignalType | None = None
    suggested_timeframe: TimeframeType | None = None
    confidence: float | None = None
    post_date: date | None = None
    created_at: datetime
