import yfinance as yf
from typing import Dict
import pandas as pd
from datetime import datetime, timedelta

class SentimentService:
    def get_market_sentiment(self) -> Dict:
        """
        Fetches macro indicators (VIX, 10Y Treasury, Gold) and determines the overall market regime.
        """
        end_date = datetime.now()
        start_date = end_date - timedelta(days=30)
        # Define tickers for macro analysis
        # ^VIX: Volatility Index
        # ^TNX: 10-Year Treasury Yield
        # GC=F: Gold Futures (Safe Haven)
        symbols = ['^VIX', '^TNX', 'GC=F']
        
        try:
            # yf.download is usually more stable for multiple tickers, and helps avoid hanging
            df = yf.download(symbols, start=start_date.strftime('%Y-%m-%d'), end=end_date.strftime('%Y-%m-%d'), interval="1d", progress=False, threads=False)
            
            if df.empty:
                return {"status": "error", "message": "Could not fetch history for market sentiment symbols"}
            
            close_prices = df['Close']
            
            vix_hist = close_prices['^VIX'].dropna()
            tnx_hist = close_prices['^TNX'].dropna()
            gold_hist = close_prices['GC=F'].dropna()

            if vix_hist.empty or tnx_hist.empty or gold_hist.empty:
                 return {"status": "error", "message": "Partial data returned for sentiment symbols"}

            vix_current = float(vix_hist.iloc[-1])
            vix_1w_ago = float(vix_hist.iloc[-5]) if len(vix_hist) >= 5 else float(vix_hist.iloc[0])
            
            # Simple VIX Trends
            vix_trend = "RISING" if vix_current > vix_1w_ago * 1.05 else "FALLING" if vix_current < vix_1w_ago * 0.95 else "FLAT"
            
            gold_current = float(gold_hist.iloc[-1])
            gold_1w_ago = float(gold_hist.iloc[-5]) if len(gold_hist) >= 5 else float(gold_hist.iloc[0])
            
            tnx_current = float(tnx_hist.iloc[-1])
            tnx_1w_ago = float(tnx_hist.iloc[-5]) if len(tnx_hist) >= 5 else float(tnx_hist.iloc[0])

            is_gold_rising = gold_current > gold_1w_ago
            is_yield_falling = tnx_current < tnx_1w_ago

            market_regime = "NORMAL"
            if vix_current > 25:
                market_regime = "HIGH_FEAR"
            elif vix_current > 20 and is_gold_rising and is_yield_falling:
                market_regime = "RISK_OFF"
            elif vix_current < 15:
                market_regime = "COMPLACENCY"

            return {
                "vix": {
                    "value": vix_current,
                    "trend": vix_trend,
                    "previousWeek": vix_1w_ago
                },
                "safeHavens": {
                    "goldTrend": "RISING" if is_gold_rising else "FALLING",
                    "treasuryYieldTrend": "RISING" if not is_yield_falling else "FALLING"
                },
                "marketRegime": market_regime,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            print(f"Failed to fetch market sentiment: {e}")
            return {"status": "error", "message": "Failed to fetch market sentiment data"}

sentiment_service = SentimentService()
