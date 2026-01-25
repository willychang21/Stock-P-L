"""
Price Cache Service

Provides caching layer for market data to avoid repeated Yahoo Finance API calls.
Uses DuckDB for persistent storage with TTL-based invalidation.

This implementation follows Google SDE standards:
- Dependency Injection for testability
- Protocol-based interfaces
- Immutable dataclasses for value objects
- UTC timestamps for all time operations
- Comprehensive type hints and docstrings
"""
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Tuple, Optional

from app.models.cache import PriceQuote, HistoricalPrice, CacheConfig, QuoteType
from app.interfaces.cache import DatabaseProvider, ClockProvider


class SystemClock:
    """Default clock implementation using system time."""
    
    def now(self) -> datetime:
        """Get current time in UTC."""
        return datetime.now(timezone.utc)


class PriceCacheService:
    """
    Cache service for real-time price quotes.
    
    Uses dependency injection for database and clock providers, making it
    easy to test with mocks.
    
    Example:
        >>> db = Database(DB_PATH)
        >>> cache = PriceCacheService(db)
        >>> cached, missing = cache.get(["AAPL", "GOOGL"])
    """
    
    def __init__(
        self,
        db_provider: DatabaseProvider,
        clock: Optional[ClockProvider] = None,
        config: Optional[CacheConfig] = None,
    ):
        """
        Initialize the cache service.
        
        Args:
            db_provider: Database connection provider.
            clock: Clock provider for time operations (defaults to system clock).
            config: Cache configuration (defaults to standard settings).
        """
        self._db = db_provider
        self._clock = clock or SystemClock()
        self._config = config or CacheConfig()
    
    def get(self, symbols: List[str]) -> Tuple[Dict[str, dict], List[str]]:
        """
        Retrieve cached prices for given symbols.
        
        Args:
            symbols: List of stock symbols to look up.
            
        Returns:
            Tuple of (cached_results, missing_symbols):
            - cached_results: Dict mapping symbol to price data
            - missing_symbols: List of symbols not found or expired
        """
        if not symbols:
            return {}, []
        
        normalized = [s.upper() for s in symbols]
        now = self._clock.now()
        ttl_seconds = self._config.get_ttl_seconds(now)
        cutoff = now - timedelta(seconds=ttl_seconds)
        
        cached: Dict[str, dict] = {}
        missing: List[str] = []
        
        conn = self._db.get_connection()
        try:
            placeholders = ",".join(["?" for _ in normalized])
            query = f"""
                SELECT symbol, price, change, change_percent, updated_at, quote_type
                FROM prices
                WHERE symbol IN ({placeholders})
            """
            rows = conn.execute(query, normalized).fetchall()
            
            # Build lookup table
            cache_lookup: Dict[str, dict] = {}
            for row in rows:
                symbol, price, change, change_pct, updated_at, quote_type = row
                
                # Handle timezone-naive timestamps from DB
                if updated_at.tzinfo is None:
                    updated_at = updated_at.replace(tzinfo=timezone.utc)
                
                cache_lookup[symbol] = {
                    "symbol": symbol,
                    "regularMarketPrice": price,
                    "regularMarketChange": change,
                    "regularMarketChangePercent": change_pct,
                    "quoteType": quote_type or "EQUITY",
                    "currency": "USD",
                    "_updated_at": updated_at,
                }
            
            # Check each symbol for freshness
            for symbol in normalized:
                if symbol in cache_lookup:
                    entry = cache_lookup[symbol]
                    if entry["_updated_at"] >= cutoff:
                        # Remove internal field before returning
                        result = {k: v for k, v in entry.items() if not k.startswith("_")}
                        cached[symbol] = result
                    else:
                        missing.append(symbol)
                else:
                    missing.append(symbol)
                    
        finally:
            pass  # DuckDB cursors don't need explicit closing
        
        return cached, missing
    
    def set(self, quotes: List[dict]) -> None:
        """
        Store price quotes in cache.
        
        Args:
            quotes: List of price quote dictionaries from market data provider.
        """
        if not quotes:
            return
        
        now = self._clock.now()
        conn = self._db.get_connection()
        
        try:
            for quote in quotes:
                symbol = quote.get("symbol", "").upper()
                if not symbol:
                    continue
                
                conn.execute(
                    """
                    INSERT INTO prices (symbol, price, change, change_percent, updated_at, quote_type)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT (symbol) DO UPDATE SET
                        price = excluded.price,
                        change = excluded.change,
                        change_percent = excluded.change_percent,
                        updated_at = excluded.updated_at,
                        quote_type = excluded.quote_type
                    """,
                    [
                        symbol,
                        float(quote.get("regularMarketPrice", 0)),
                        float(quote.get("regularMarketChange", 0)),
                        float(quote.get("regularMarketChangePercent", 0)),
                        now,
                        quote.get("quoteType", "EQUITY"),
                    ],
                )
        finally:
            pass
    
    def invalidate(self, symbols: Optional[List[str]] = None) -> None:
        """
        Invalidate cached entries.
        
        Args:
            symbols: Specific symbols to invalidate, or None for all.
        """
        conn = self._db.get_connection()
        try:
            if symbols is None:
                conn.execute("DELETE FROM prices")
            else:
                normalized = [s.upper() for s in symbols]
                placeholders = ",".join(["?" for _ in normalized])
                conn.execute(f"DELETE FROM prices WHERE symbol IN ({placeholders})", normalized)
        finally:
            pass


class HistoricalPriceCacheService:
    """
    Cache service for historical price data.
    
    Historical prices are permanent - once a day's data is recorded, it doesn't change.
    This allows indefinite caching.
    """
    
    # Threshold for considering data "complete" (60% of expected trading days)
    COMPLETENESS_THRESHOLD = 0.6
    # Approximate trading days per year
    TRADING_DAYS_PER_YEAR = 252
    
    def __init__(
        self,
        db_provider: DatabaseProvider,
        clock: Optional[ClockProvider] = None,
    ):
        """
        Initialize the historical cache service.
        
        Args:
            db_provider: Database connection provider.
            clock: Clock provider for timestamps.
        """
        self._db = db_provider
        self._clock = clock or SystemClock()
    
    def get(self, symbol: str, start_date: str, end_date: str) -> List[dict]:
        """
        Retrieve cached historical prices for a date range.
        
        Args:
            symbol: Stock symbol.
            start_date: Start date (YYYY-MM-DD).
            end_date: End date (YYYY-MM-DD).
            
        Returns:
            List of historical price dictionaries.
        """
        conn = self._db.get_connection()
        try:
            rows = conn.execute(
                """
                SELECT date, open, high, low, close, volume
                FROM historical_prices
                WHERE symbol = ?
                  AND date >= ?
                  AND date <= ?
                ORDER BY date ASC
                """,
                [symbol.upper(), start_date, end_date],
            ).fetchall()
            
            prices = []
            for row in rows:
                date, open_p, high, low, close, volume = row
                date_str = date.strftime("%Y-%m-%d") if hasattr(date, "strftime") else str(date)
                prices.append({
                    "date": date_str,
                    "open": open_p,
                    "high": high,
                    "low": low,
                    "close": close,
                    "volume": volume or 0,
                })
            
            return prices
        finally:
            pass
    
    def set(self, symbol: str, prices: List[dict]) -> None:
        """
        Store historical prices in cache.
        
        Args:
            symbol: Stock symbol.
            prices: List of OHLCV price dictionaries.
        """
        if not prices:
            return
        
        now = self._clock.now()
        upper_symbol = symbol.upper()
        conn = self._db.get_connection()
        
        try:
            for price in prices:
                date_str = price.get("date")
                if not date_str:
                    continue
                
                conn.execute(
                    """
                    INSERT INTO historical_prices (symbol, date, open, high, low, close, volume, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT (symbol, date) DO UPDATE SET
                        open = excluded.open,
                        high = excluded.high,
                        low = excluded.low,
                        close = excluded.close,
                        volume = excluded.volume
                    """,
                    [
                        upper_symbol,
                        date_str,
                        price.get("open", 0),
                        price.get("high", 0),
                        price.get("low", 0),
                        price.get("close", 0),
                        price.get("volume", 0),
                        now,
                    ],
                )
        finally:
            pass
    
    def has_complete_data(self, symbol: str, start_date: str, end_date: str) -> bool:
        """
        Check if cache has complete data for the date range.
        
        Uses a heuristic: if we have at least 60% of expected trading days,
        consider the data complete.
        
        Args:
            symbol: Stock symbol.
            start_date: Start date (YYYY-MM-DD).
            end_date: End date (YYYY-MM-DD).
            
        Returns:
            True if cache has sufficient data coverage.
        """
        conn = self._db.get_connection()
        try:
            result = conn.execute(
                """
                SELECT COUNT(*) as count
                FROM historical_prices
                WHERE symbol = ?
                  AND date >= ?
                  AND date <= ?
                """,
                [symbol.upper(), start_date, end_date],
            ).fetchone()
            
            count = result[0] if result else 0
            
            # Calculate expected trading days
            start = datetime.strptime(start_date, "%Y-%m-%d")
            end = datetime.strptime(end_date, "%Y-%m-%d")
            calendar_days = (end - start).days
            expected_trading_days = int(calendar_days * self.TRADING_DAYS_PER_YEAR / 365)
            
            # Consider complete if we have enough data
            return count >= expected_trading_days * self.COMPLETENESS_THRESHOLD
        finally:
            pass


# =============================================================================
# Dependency Injection Factory
# =============================================================================

def create_price_cache() -> PriceCacheService:
    """Factory function to create PriceCacheService with default dependencies."""
    from app.db.session import db
    return PriceCacheService(db)


def create_historical_cache() -> HistoricalPriceCacheService:
    """Factory function to create HistoricalPriceCacheService with default dependencies."""
    from app.db.session import db
    return HistoricalPriceCacheService(db)


# Default instances for backward compatibility
# In production, prefer using the factory functions or explicit DI
price_cache_service = create_price_cache()
historical_price_cache_service = create_historical_cache()
