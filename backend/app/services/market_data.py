import yfinance as yf
from app.models.price import Price
from typing import List, Dict
import asyncio
from concurrent.futures import ThreadPoolExecutor

class MarketDataService:

    def get_quotes(self, symbols: List[str]) -> List[Dict]:
        if not symbols:
            return []
            
        tickers = yf.Tickers(' '.join(symbols))
        results = []
        
        def fetch_data(symbol):
            try:
                # Accessing .tickers[symbol] might be lazy, but accessing .fast_info triggers request
                ticker = tickers.tickers[symbol]
                
                price = None
                quote_type = "EQUITY" # Default
                
                try:
                    # Try fast_info first
                    info = ticker.fast_info
                    price = info.get('last_price')
                    quote_type = info.get('quoteType', 'EQUITY')
                except:
                    pass
                
                if price is None:
                    # Fallback to history
                    hist = ticker.history(period="1d")
                    if not hist.empty:
                        price = hist['Close'].iloc[-1]
                        # History doesn't give quoteType easily, stick to default or try info (slow)
                
                if price is not None:
                    return {
                        "symbol": symbol,
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
        with ThreadPoolExecutor(max_workers=min(len(symbols), 20)) as executor:
            futures = [executor.submit(fetch_data, sym) for sym in symbols]
            for future in futures:
                res = future.result()
                if res:
                    results.append(res)
                
        return results

    def get_historical_prices(self, symbol: str, start_date: str, end_date: str) -> Dict:
        try:
            ticker = yf.Ticker(symbol)
            # yfinance expects YYYY-MM-DD
            hist = ticker.history(start=start_date, end=end_date, interval="1d")
            
            prices = []
            for date, row in hist.iterrows():
                # date is Timestamp
                prices.append({
                    "date": date.strftime('%Y-%m-%d'),
                    "open": row['Open'],
                    "high": row['High'],
                    "low": row['Low'],
                    "close": row['Close'],
                    "volume": int(row['Volume'])
                })
                
            return {
                "symbol": symbol,
                "prices": prices
            }
        except Exception as e:
            print(f"Failed to fetch historical for {symbol}: {e}")
            return {"symbol": symbol, "prices": []}


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
