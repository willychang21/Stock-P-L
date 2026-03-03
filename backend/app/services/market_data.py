from __future__ import annotations
import yfinance as yf
import pandas as pd
import polars as pl
import math
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
        
        # 3. Fetch missing symbols from Yahoo Finance
        def fetch_data(symbol):
            try:
                # Use individual Ticker for more reliability
                ticker = yf.Ticker(symbol)
                
                price = None
                quote_type = "EQUITY"
                
                # Method A: fast_info (quickest)
                try:
                    info = ticker.fast_info
                    price = info.get('lastPrice') or info.get('last_price')
                    quote_type = info.get('quoteType', 'EQUITY')
                except:
                    pass
                
                # Method B: history (fallback)
                if price is None:
                    hist = ticker.history(period="1d")
                    if not hist.empty:
                        price = float(hist['Close'].iloc[-1])
                
                # Method C: ticker.info (slowest, but contains most data)
                if price is None:
                    try:
                        inf = ticker.info
                        price = inf.get('currentPrice') or inf.get('regularMarketPrice')
                    except:
                        pass

                if price is not None:
                    # Map back to original symbol name if aliased
                    original_sym = yf_to_original.get(symbol, symbol)
                    return {
                        "symbol": original_sym,
                        "regularMarketPrice": float(price),
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
        with ThreadPoolExecutor(max_workers=min(len(missing_symbols), 10)) as executor:
            futures = [executor.submit(fetch_data, sym) for sym in missing_symbols]
            for future in futures:
                try:
                    res = future.result(timeout=15) # Add timeout per symbol
                    if res:
                        fresh_quotes.append(res)
                        results.append(res)
                except Exception as e:
                    print(f"Worker thread failed or timed out: {e}")
        
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


    def get_historical_financials(self, symbol: str) -> Dict:
        upper_symbol = symbol.upper()
        yf_symbol = self._normalize_symbol(symbol)
        ticker = yf.Ticker(yf_symbol)
        
        try:
            # yfinance returns pandas DataFrames. We convert them to Polars.
            df_fin_pd = ticker.financials
            df_cf_pd = ticker.cashflow
            df_bs_pd = ticker.balance_sheet
            
            if df_fin_pd.empty:
                return {"symbol": upper_symbol, "years": [], "metrics": {}}

            # Convert to Polars (Transpose first to get dates as rows)
            def to_pl(df_pd):
                if df_pd.empty: return None
                # Dates are in columns in yf.financials, let's transpose
                df_pd_t = df_pd.T
                # Make index a column
                df_pd_t = df_pd_t.reset_index().rename(columns={"index": "date"})
                return pl.from_pandas(df_pd_t)

            df_fin = to_pl(df_fin_pd)
            df_cf = to_pl(df_cf_pd)
            df_bs = to_pl(df_bs_pd)
                
            # Get historical prices at fiscal year ends
            prices = {}
            from datetime import timedelta
            for date in df_fin_pd.columns:
                start_date = date
                end_date = date + timedelta(days=7)
                hist = ticker.history(start=start_date.strftime('%Y-%m-%d'), 
                                     end=end_date.strftime('%Y-%m-%d'))
                if not hist.empty:
                    prices[date.strftime('%Y-%m-%d')] = float(hist['Close'].iloc[0])
                else:
                    prices[date.strftime('%Y-%m-%d')] = None

            def get_val(df, date_obj, keys):
                if df is None: return None
                # Filter by date object (matches Polars datetime[ns])
                row = df.filter(pl.col("date") == date_obj)
                if row.is_empty(): return None
                for key in keys:
                    if key in row.columns:
                        val = row.get_column(key)[0]
                        return float(val) if val is not None and not (isinstance(val, float) and math.isnan(val)) else None
                return None

            years_list = []
            for date_dt in df_fin_pd.columns:
                date_str = date_dt.strftime('%Y-%m-%d')
                
                revenue = get_val(df_fin, date_dt, ['Total Revenue', 'Operating Revenue'])
                op_income = get_val(df_fin, date_dt, ['Operating Income'])
                ebitda = get_val(df_fin, date_dt, ['EBITDA'])
                net_income = get_val(df_fin, date_dt, ['Net Income'])
                eps = get_val(df_fin, date_dt, ['Diluted EPS', 'Basic EPS'])
                fcf = get_val(df_cf, date_dt, ['Free Cash Flow'])
                equity = get_val(df_bs, date_dt, ['Stockholders Equity', 'Total Assets'])
                shares = get_val(df_fin, date_dt, ['Diluted Average Shares', 'Basic Average Shares'])
                
                normalized_income = get_val(df_fin, date_dt, ['Normalized Income'])
                eps_nri = (normalized_income / shares) if normalized_income and shares else eps

                year_data = {
                    "date": date_str,
                    "revenue": revenue,
                    "operating_income": op_income,
                    "ebitda": ebitda,
                    "net_income": net_income,
                    "eps": eps,
                    "eps_nri": eps_nri,
                    "fcf": fcf,
                    "book_value": equity,
                    "price": prices.get(date_str),
                }
                
                if shares and shares > 0:
                    year_data["revenue_per_share"] = revenue / shares if revenue else None
                    year_data["fcf_per_share"] = fcf / shares if fcf else None
                    year_data["book_value_per_share"] = equity / shares if equity else None
                
                years_list.append(year_data)

            # Calculate growth rates (CAGR)
            def calc_cagr(data_series, years_count):
                # data_series is [recent, ..., old]
                if len(data_series) < years_count + 1:
                    return None
                try:
                    current = data_series[0]
                    past = data_series[years_count]
                    if current and past and current > 0 and past > 0:
                        return (current / past) ** (1 / years_count) - 1
                except:
                    pass
                return None

            return {
                "symbol": upper_symbol,
                "years": years_list,
                "growth_rates": {
                    "revenue_3y": calc_cagr([y.get("revenue_per_share") for y in years_list], 3),
                    "eps_nri_3y": calc_cagr([y.get("eps_nri") for y in years_list], 3),
                    "fcf_3y": calc_cagr([y.get("fcf_per_share") for y in years_list], 3),
                    "book_value_3y": calc_cagr([y.get("book_value_per_share") for y in years_list], 3),
                }
            }
        except Exception as e:
            print(f"Failed to fetch historical financials for {symbol}: {e}")
            return {"symbol": upper_symbol, "error": str(e)}

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
                    "beta": info.get("beta"),
                    # New Fundamental & Valuation Fields
                    "trailingEps": info.get("trailingEps"),
                    "forwardEps": info.get("forwardEps"),
                    "profitMargins": info.get("profitMargins"),
                    "returnOnEquity": info.get("returnOnEquity"),
                    "returnOnAssets": info.get("returnOnAssets"),
                    "revenueGrowth": info.get("revenueGrowth"),
                    "debtToEquity": info.get("debtToEquity"),
                    "exDividendDate": info.get("exDividendDate"),
                    "payoutRatio": info.get("payoutRatio"),
                    "earningsDate": info.get("earningsDate"), # Sometimes a list depending on yfinance version
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
