from __future__ import annotations
import yfinance as yf
from app.models.price import Price
from typing import List, Dict
import asyncio
from concurrent.futures import ThreadPoolExecutor
from app.services.price_cache import price_cache_service, historical_price_cache_service

class MarketDataService:

    # Common non-stock tickers → Yahoo Finance symbols
    SYMBOL_ALIASES = {
        "US10Y": "^TNX",    # 10-Year Treasury Yield
        "US2Y": "^IRX",     # 2-Year (closest proxy)
        "US30Y": "^TYX",    # 30-Year Treasury Yield
        "VIX": "^VIX",      # Volatility Index
        "DXY": "DX-Y.NYB",  # US Dollar Index
        "GOLD": "GC=F",     # Gold Futures
        "OIL": "CL=F",      # Crude Oil Futures
        "BTC": "BTC-USD",   # Bitcoin
        "ETH": "ETH-USD",   # Ethereum
    }

    def _normalize_symbol(self, symbol: str) -> str:
        """Normalize symbol: apply aliases, uppercase."""
        upper = symbol.upper()
        return self.SYMBOL_ALIASES.get(upper, upper)

    def get_quotes(self, symbols: List[str]) -> List[Dict]:
        if not symbols:
            return []
        
        # Normalize symbols and apply aliases
        original_to_yf = {s.upper(): self._normalize_symbol(s) for s in symbols}
        yf_to_original = {v: k for k, v in original_to_yf.items()}
        normalized_symbols = list(set(original_to_yf.values()))
        
        # 1. Check cache first
        cached_results, missing_symbols = price_cache_service.get(normalized_symbols)
        
        results = list(cached_results.values())
        
        # 2. If all symbols are cached and valid, return immediately
        if not missing_symbols:
            print(f"✅ Cache HIT for all {len(normalized_symbols)} symbols")
            return results
        
        print(f"📡 Cache MISS: fetching {len(missing_symbols)} of {len(normalized_symbols)} symbols from Yahoo Finance")
        
        # 3. Fetch only missing symbols from Yahoo Finance
        tickers = yf.Tickers(' '.join(missing_symbols))
        
        def fetch_data(symbol):
            try:
                ticker = tickers.tickers[symbol]
                
                price = None
                quote_type = "EQUITY"
                
                try:
                    info = ticker.fast_info
                    price = info.get('last_price')
                    quote_type = info.get('quoteType', 'EQUITY')
                except:
                    pass
                
                if price is None:
                    hist = ticker.history(period="1d")
                    if not hist.empty:
                        price = hist['Close'].iloc[-1]
                
                if price is not None:
                    # Map back to original symbol name if aliased
                    original_sym = yf_to_original.get(symbol, symbol)
                    return {
                        "symbol": original_sym,
                        "regularMarketPrice": price,
                        "quoteType": quote_type,
                        "regularMarketChange": 0,
                        "regularMarketChangePercent": 0,
                        "currency": "USD"
                    }
            except Exception as e:
                print(f"Failed to fetch quote for {symbol}: {e}")
            return None

        # Parallelize to speed up
        fresh_quotes = []
        with ThreadPoolExecutor(max_workers=min(len(missing_symbols), 20)) as executor:
            futures = [executor.submit(fetch_data, sym) for sym in missing_symbols]
            for future in futures:
                res = future.result()
                if res:
                    fresh_quotes.append(res)
                    results.append(res)
        
        # 4. Update cache with fresh data
        if fresh_quotes:
            price_cache_service.set(fresh_quotes)
        
        return results

    def get_historical_prices(self, symbol: str, start_date: str, end_date: str) -> Dict:
        upper_symbol = symbol.upper()
        yf_symbol = self._normalize_symbol(symbol)
        
        # 1. Check if we have complete cached data
        if historical_price_cache_service.has_complete_data(upper_symbol, start_date, end_date):
            cached_prices = historical_price_cache_service.get(
                upper_symbol, start_date, end_date
            )
            print(f"✅ Historical cache HIT for {upper_symbol}: {len(cached_prices)} days")
            return {
                "symbol": upper_symbol,
                "prices": cached_prices
            }
        
        # 2. Fetch from Yahoo Finance
        print(f"📡 Historical cache MISS for {upper_symbol}: fetching from Yahoo Finance")
        try:
            ticker = yf.Ticker(yf_symbol)
            hist = ticker.history(start=start_date, end=end_date, interval="1d")
            
            prices = []
            for date, row in hist.iterrows():
                prices.append({
                    "date": date.strftime('%Y-%m-%d'),
                    "open": row['Open'],
                    "high": row['High'],
                    "low": row['Low'],
                    "close": row['Close'],
                    "volume": int(row['Volume'])
                })
            
            # 3. Update cache with fresh data
            if prices:
                historical_price_cache_service.set(upper_symbol, prices)
            
            return {
                "symbol": upper_symbol,
                "prices": prices
            }
        except Exception as e:
            print(f"Failed to fetch historical for {symbol}: {e}")
            
            # Fallback to partial cached data if available
            cached_prices = historical_price_cache_service.get(
                upper_symbol, start_date, end_date
            )
            if cached_prices:
                print(f"⚠️ Using partial cache: {len(cached_prices)} days")
                return {
                    "symbol": upper_symbol,
                    "prices": cached_prices
                }
            
            return {"symbol": upper_symbol, "prices": []}


    def get_fundamentals(self, symbols: List[str]) -> List[Dict]:
        if not symbols:
            return []
            
        tickers = yf.Tickers(' '.join(symbols))
        results = []
        
        def fetch_info(symbol):
            try:
                ticker = tickers.tickers[symbol]
                info = ticker.info
                return {
                    "symbol": symbol,
                    "sector": info.get('sector'),
                    "industry": info.get('industry'),
                    "marketCap": info.get('marketCap'),
                    "trailingPE": info.get('trailingPE'),
                    "forwardPE": info.get('forwardPE'),
                    "fiftyTwoWeekHigh": info.get('fiftyTwoWeekHigh'),
                    "fiftyTwoWeekLow": info.get('fiftyTwoWeekLow'),
                    "dividendYield": info.get('dividendYield'),
                    "beta": info.get("beta")
                }
            except Exception as e:
                print(f"Failed to fetch fundamentals for {symbol}: {e}")
                return None

        # Parallelize
        with ThreadPoolExecutor(max_workers=min(len(symbols), 10)) as executor:
            futures = [executor.submit(fetch_info, sym) for sym in symbols]
            for future in futures:
                res = future.result()
                if res:
                    results.append(res)
                
        return results

market_data_service = MarketDataService()
