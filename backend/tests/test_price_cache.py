"""
Unit Tests for Price Cache Services

These tests demonstrate how dependency injection enables easy testing
with mock database and clock providers.
"""
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch
from typing import List

from app.services.price_cache import (
    PriceCacheService,
    HistoricalPriceCacheService,
    SystemClock,
)
from app.models.cache import CacheConfig


class FakeClock:
    """Fake clock for testing."""
    
    def __init__(self, fixed_time: datetime):
        self._time = fixed_time
    
    def now(self) -> datetime:
        return self._time
    
    def advance(self, seconds: int) -> None:
        """Advance the clock by specified seconds."""
        self._time = self._time + timedelta(seconds=seconds)


class FakeDatabase:
    """In-memory fake database for testing."""
    
    def __init__(self):
        self._prices = {}  # symbol -> row data
        self._historical = {}  # (symbol, date) -> row data
    
    def get_connection(self):
        return FakeCursor(self)


class FakeCursor:
    """Fake database cursor."""
    
    def __init__(self, db: FakeDatabase):
        self._db = db
        self._last_result = []
    
    def execute(self, query: str, params: List = None):
        query_lower = query.strip().lower()
        
        if query_lower.startswith("select") and "from prices" in query_lower:
            # Simulate price query
            symbols = params or []
            self._last_result = []
            for symbol in symbols:
                if symbol in self._db._prices:
                    row = self._db._prices[symbol]
                    self._last_result.append((
                        row["symbol"],
                        row["price"],
                        row["change"],
                        row["change_percent"],
                        row["updated_at"],
                        row["quote_type"],
                    ))
        
        elif query_lower.startswith("insert") and "into prices" in query_lower:
            # Simulate price insert
            symbol = params[0]
            self._db._prices[symbol] = {
                "symbol": symbol,
                "price": params[1],
                "change": params[2],
                "change_percent": params[3],
                "updated_at": params[4],
                "quote_type": params[5],
            }
        
        elif query_lower.startswith("delete") and "from prices" in query_lower:
            if params:
                for symbol in params:
                    self._db._prices.pop(symbol, None)
            else:
                self._db._prices.clear()
        
        elif query_lower.startswith("select") and "from historical_prices" in query_lower:
            # Simulate historical query
            if "count" in query_lower:
                symbol, start, end = params[0], params[1], params[2]
                count = sum(
                    1 for (s, d) in self._db._historical
                    if s == symbol and start <= d <= end
                )
                self._last_result = [(count,)]
            else:
                symbol, start, end = params[0], params[1], params[2]
                self._last_result = []
                for (s, d), row in sorted(self._db._historical.items()):
                    if s == symbol and start <= d <= end:
                        self._last_result.append((
                            d, row["open"], row["high"], row["low"], row["close"], row["volume"]
                        ))
        
        elif query_lower.startswith("insert") and "into historical_prices" in query_lower:
            symbol, date = params[0], params[1]
            self._db._historical[(symbol, date)] = {
                "open": params[2],
                "high": params[3],
                "low": params[4],
                "close": params[5],
                "volume": params[6],
            }
        
        return self
    
    def fetchall(self):
        return self._last_result
    
    def fetchone(self):
        return self._last_result[0] if self._last_result else None


# =============================================================================
# Tests for PriceCacheService
# =============================================================================

class TestPriceCacheService:
    """Tests for real-time price cache."""
    
    def test_get_returns_empty_for_no_symbols(self):
        """get() with empty list returns empty results."""
        db = FakeDatabase()
        cache = PriceCacheService(db)
        
        cached, missing = cache.get([])
        
        assert cached == {}
        assert missing == []
    
    def test_get_returns_missing_for_uncached_symbols(self):
        """get() returns symbols as missing when not in cache."""
        db = FakeDatabase()
        cache = PriceCacheService(db)
        
        cached, missing = cache.get(["AAPL", "GOOGL"])
        
        assert cached == {}
        assert set(missing) == {"AAPL", "GOOGL"}
    
    def test_set_and_get_roundtrip(self):
        """set() stores data that get() can retrieve."""
        db = FakeDatabase()
        clock = FakeClock(datetime(2024, 1, 15, 14, 0, tzinfo=timezone.utc))
        cache = PriceCacheService(db, clock=clock)
        
        # Store a quote
        cache.set([{
            "symbol": "AAPL",
            "regularMarketPrice": 150.0,
            "regularMarketChange": 2.5,
            "regularMarketChangePercent": 1.7,
            "quoteType": "EQUITY",
        }])
        
        # Retrieve it
        cached, missing = cache.get(["AAPL"])
        
        assert "AAPL" in cached
        assert cached["AAPL"]["regularMarketPrice"] == 150.0
        assert missing == []
    
    def test_cache_expires_after_ttl(self):
        """Cached data expires after TTL."""
        db = FakeDatabase()
        clock = FakeClock(datetime(2024, 1, 15, 14, 0, tzinfo=timezone.utc))
        config = CacheConfig(market_hours_ttl_seconds=60)  # 1 minute TTL
        cache = PriceCacheService(db, clock=clock, config=config)
        
        # Store a quote
        cache.set([{"symbol": "AAPL", "regularMarketPrice": 150.0}])
        
        # Advance clock beyond TTL
        clock.advance(120)  # 2 minutes
        
        # Should be expired now
        cached, missing = cache.get(["AAPL"])
        
        assert cached == {}
        assert missing == ["AAPL"]
    
    def test_invalidate_clears_cache(self):
        """invalidate() removes cached data."""
        db = FakeDatabase()
        cache = PriceCacheService(db)
        
        cache.set([{"symbol": "AAPL", "regularMarketPrice": 150.0}])
        cache.invalidate()
        
        cached, missing = cache.get(["AAPL"])
        
        assert cached == {}
        assert missing == ["AAPL"]


# =============================================================================
# Tests for HistoricalPriceCacheService
# =============================================================================

class TestHistoricalPriceCacheService:
    """Tests for historical price cache."""
    
    def test_get_returns_empty_for_uncached_symbol(self):
        """get() returns empty list for uncached symbol."""
        db = FakeDatabase()
        cache = HistoricalPriceCacheService(db)
        
        prices = cache.get("AAPL", "2024-01-01", "2024-01-31")
        
        assert prices == []
    
    def test_set_and_get_roundtrip(self):
        """set() stores data that get() can retrieve."""
        db = FakeDatabase()
        cache = HistoricalPriceCacheService(db)
        
        cache.set("AAPL", [
            {"date": "2024-01-15", "open": 148, "high": 152, "low": 147, "close": 150, "volume": 1000},
            {"date": "2024-01-16", "open": 150, "high": 155, "low": 149, "close": 154, "volume": 1200},
        ])
        
        prices = cache.get("AAPL", "2024-01-01", "2024-01-31")
        
        assert len(prices) == 2
        assert prices[0]["date"] == "2024-01-15"
        assert prices[1]["close"] == 154
    
    def test_has_complete_data_returns_false_for_empty_cache(self):
        """has_complete_data() returns False for uncached data."""
        db = FakeDatabase()
        cache = HistoricalPriceCacheService(db)
        
        result = cache.has_complete_data("AAPL", "2024-01-01", "2024-01-31")
        
        assert result is False


# =============================================================================
# Tests for SystemClock
# =============================================================================

class TestSystemClock:
    """Tests for the system clock implementation."""
    
    def test_now_returns_utc_datetime(self):
        """SystemClock.now() returns timezone-aware UTC datetime."""
        clock = SystemClock()
        
        result = clock.now()
        
        assert result.tzinfo is not None
        assert result.tzinfo == timezone.utc


# =============================================================================
# Run tests if executed directly
# =============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
