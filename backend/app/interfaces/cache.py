"""
Interfaces for Cache System

Defines abstract protocols (interfaces) that cache implementations must follow.
Using Python's Protocol for structural subtyping (duck typing with type hints).
"""
from abc import ABC, abstractmethod
from typing import List, Dict, Tuple, Optional, Protocol
from datetime import datetime


class DatabaseProvider(Protocol):
    """Protocol for database connection providers."""
    
    def get_connection(self):
        """Get a database cursor/connection."""
        ...


class ClockProvider(Protocol):
    """
    Protocol for time providers.
    
    This abstraction allows for easy testing by injecting fake clocks.
    """
    
    def now(self) -> datetime:
        """Get current time in UTC."""
        ...


class PriceCacheProtocol(Protocol):
    """
    Protocol for real-time price cache implementations.
    
    Any class implementing this protocol can be used as a price cache.
    """
    
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
        ...
    
    def set(self, quotes: List[dict]) -> None:
        """
        Store price quotes in cache.
        
        Args:
            quotes: List of price quote dictionaries.
        """
        ...
    
    def invalidate(self, symbols: Optional[List[str]] = None) -> None:
        """
        Invalidate cached entries.
        
        Args:
            symbols: Specific symbols to invalidate, or None for all.
        """
        ...


class HistoricalPriceCacheProtocol(Protocol):
    """Protocol for historical price cache implementations."""
    
    def get(
        self, 
        symbol: str, 
        start_date: str, 
        end_date: str
    ) -> List[dict]:
        """
        Retrieve cached historical prices.
        
        Args:
            symbol: Stock symbol.
            start_date: Start date (YYYY-MM-DD).
            end_date: End date (YYYY-MM-DD).
            
        Returns:
            List of historical price dictionaries.
        """
        ...
    
    def set(self, symbol: str, prices: List[dict]) -> None:
        """
        Store historical prices in cache.
        
        Args:
            symbol: Stock symbol.
            prices: List of OHLCV price dictionaries.
        """
        ...
    
    def has_complete_data(
        self, 
        symbol: str, 
        start_date: str, 
        end_date: str
    ) -> bool:
        """
        Check if cache has complete data for the date range.
        
        Args:
            symbol: Stock symbol.
            start_date: Start date (YYYY-MM-DD).
            end_date: End date (YYYY-MM-DD).
            
        Returns:
            True if cache has sufficient data coverage.
        """
        ...


class MarketDataProvider(Protocol):
    """
    Protocol for market data providers (e.g., Yahoo Finance).
    
    This abstraction allows swapping data sources or mocking for tests.
    """
    
    def fetch_quotes(self, symbols: List[str]) -> List[dict]:
        """Fetch real-time quotes from the market data source."""
        ...
    
    def fetch_historical(
        self, 
        symbol: str, 
        start_date: str, 
        end_date: str
    ) -> List[dict]:
        """Fetch historical OHLCV data from the market data source."""
        ...
