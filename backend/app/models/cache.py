"""
Domain Models for Cache System

These dataclasses define the core data structures used by the cache system.
Following Google's style guide, we use immutable dataclasses for value objects.
"""
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional
from enum import Enum


class QuoteType(Enum):
    """Asset type classification."""
    EQUITY = "EQUITY"
    ETF = "ETF"
    MUTUAL_FUND = "MUTUAL_FUND"
    INDEX = "INDEX"
    CRYPTOCURRENCY = "CRYPTOCURRENCY"
    UNKNOWN = "UNKNOWN"


@dataclass(frozen=True)
class PriceQuote:
    """
    Immutable value object representing a real-time price quote.
    
    Attributes:
        symbol: Stock ticker symbol (uppercase).
        price: Current market price.
        change: Price change from previous close.
        change_percent: Percentage change from previous close.
        quote_type: Type of the asset.
        currency: Currency code (e.g., "USD").
        updated_at: Timestamp when this quote was fetched (UTC).
    """
    symbol: str
    price: float
    change: float = 0.0
    change_percent: float = 0.0
    quote_type: QuoteType = QuoteType.EQUITY
    currency: str = "USD"
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    
    def to_dict(self) -> dict:
        """Convert to dictionary for API responses."""
        return {
            "symbol": self.symbol,
            "regularMarketPrice": self.price,
            "regularMarketChange": self.change,
            "regularMarketChangePercent": self.change_percent,
            "quoteType": self.quote_type.value,
            "currency": self.currency,
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> "PriceQuote":
        """Create from dictionary (e.g., from Yahoo Finance response)."""
        quote_type_str = data.get("quoteType", "EQUITY")
        try:
            quote_type = QuoteType(quote_type_str)
        except ValueError:
            quote_type = QuoteType.UNKNOWN
            
        return cls(
            symbol=data.get("symbol", "").upper(),
            price=float(data.get("regularMarketPrice", 0)),
            change=float(data.get("regularMarketChange", 0)),
            change_percent=float(data.get("regularMarketChangePercent", 0)),
            quote_type=quote_type,
            currency=data.get("currency", "USD"),
        )


@dataclass(frozen=True)
class HistoricalPrice:
    """
    Immutable value object representing a single day's OHLCV data.
    
    Attributes:
        symbol: Stock ticker symbol (uppercase).
        date: Trading date (YYYY-MM-DD format).
        open: Opening price.
        high: High price.
        low: Low price.
        close: Closing price.
        volume: Trading volume.
    """
    symbol: str
    date: str  # YYYY-MM-DD format
    open: float
    high: float
    low: float
    close: float
    volume: int = 0
    
    def to_dict(self) -> dict:
        """Convert to dictionary for API responses."""
        return {
            "date": self.date,
            "open": self.open,
            "high": self.high,
            "low": self.low,
            "close": self.close,
            "volume": self.volume,
        }


@dataclass(frozen=True)
class CacheConfig:
    """
    Configuration for cache TTL behavior.
    
    Attributes:
        market_hours_ttl_seconds: TTL during market hours (default: 5 min).
        after_hours_ttl_seconds: TTL during after hours (default: 30 min).
        market_open_hour: Hour when market opens (24h format, ET assumed).
        market_close_hour: Hour when market closes (24h format, ET assumed).
    """
    market_hours_ttl_seconds: int = 300  # 5 minutes
    after_hours_ttl_seconds: int = 1800  # 30 minutes
    market_open_hour: int = 9
    market_close_hour: int = 16
    
    def get_ttl_seconds(self, now: Optional[datetime] = None) -> int:
        """
        Get appropriate TTL based on current time.
        
        Args:
            now: Current time (defaults to UTC now).
            
        Returns:
            TTL in seconds.
        """
        if now is None:
            now = datetime.now(timezone.utc)
        
        # Simple heuristic: weekday and between market hours
        is_weekday = now.weekday() < 5
        is_market_hours = self.market_open_hour <= now.hour < self.market_close_hour
        
        if is_weekday and is_market_hours:
            return self.market_hours_ttl_seconds
        return self.after_hours_ttl_seconds
