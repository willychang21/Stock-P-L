import yfinance as yf
from typing import List, Dict, Optional
import pandas as pd
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor

class TechnicalService:
    def _calculate_rsi(self, series: pd.Series, period: int = 14) -> Optional[float]:
        """Calculates Wilder's RSI."""
        if len(series) < period + 1:
            return None
            
        delta = series.diff()
        gain = (delta.where(delta > 0, 0)).fillna(0)
        loss = (-delta.where(delta < 0, 0)).fillna(0)

        # Calculate initial averages
        avg_gain = gain[:period].mean()
        avg_loss = loss[:period].mean()

        if pd.isna(avg_gain) or pd.isna(avg_loss):
             return None

        # Calculate Wilder's smoothed moving averages
        for i in range(period, len(gain)):
            avg_gain = (avg_gain * (period - 1) + gain.iloc[i]) / period
            avg_loss = (avg_loss * (period - 1) + loss.iloc[i]) / period

        if avg_loss == 0:
            return 100.0

        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))
        return float(rsi)

    def get_technicals(self, symbols: List[str]) -> List[Dict]:
        if not symbols:
            return []
            
        results = []
        
        # Calculate start date for historical price fetch (to ensure we have enough days for 14-day RSI and 50/200 MA if needed)
        # 6 months of trading days is around 125 days, plenty for RSI-14
        end_date = datetime.now()
        start_date = end_date - timedelta(days=180)
        
        def fetch_technicals(symbol: str):
            try:
                ticker = yf.Ticker(symbol)
                
                # Fetch info once
                info = ticker.info
                # Some basic indicators come from info
                fifty_two_week_high = info.get('fiftyTwoWeekHigh')
                fifty_two_week_low = info.get('fiftyTwoWeekLow')
                current_price = info.get('currentPrice') or info.get('regularMarketPrice')
                
                # Fetch history for calculated indicators
                hist = ticker.history(start=start_date.strftime('%Y-%m-%d'), end=end_date.strftime('%Y-%m-%d'), interval="1d")
                
                if hist.empty:
                     return None
                     
                close_prices = hist['Close']
                volumes = hist['Volume']
                
                # Use calculated price if yfinance info is lagging
                if not current_price and not close_prices.empty:
                    current_price = float(close_prices.iloc[-1])
                
                # Calculate RSI
                rsi_14 = self._calculate_rsi(close_prices, 14)
                
                # Calculate Volume Trends
                recent_volume = float(volumes.iloc[-1]) if not volumes.empty else None
                avg_volume_10d = float(volumes.tail(10).mean()) if len(volumes) >= 10 else None
                avg_volume_3m = float(volumes.mean()) if not volumes.empty else None
                
                # Determine 52-week position (0 to 1, where 1 is at 52-week high)
                fifty_two_week_position = None
                if fifty_two_week_high and fifty_two_week_low and current_price:
                    range_size = fifty_two_week_high - fifty_two_week_low
                    if range_size > 0:
                        raw_pos = (current_price - fifty_two_week_low) / range_size
                        fifty_two_week_position = max(0.0, min(1.0, raw_pos)) # Clamp 0-1
                
                # Generate Warnings/Signals
                warnings = []
                if rsi_14 and rsi_14 > 70:
                    warnings.append(f"Overbought (RSI: {rsi_14:.1f})")
                elif rsi_14 and rsi_14 < 30:
                    warnings.append(f"Oversold (RSI: {rsi_14:.1f})")
                    
                if fifty_two_week_position and fifty_two_week_position > 0.95:
                    warnings.append("Near 52-Week High")
                elif fifty_two_week_position and fifty_two_week_position < 0.05:
                    warnings.append("Near 52-Week Low")
                
                return {
                    "symbol": symbol,
                    "rsi14": rsi_14,
                    "fiftyTwoWeekHigh": fifty_two_week_high,
                    "fiftyTwoWeekLow": fifty_two_week_low,
                    "fiftyTwoWeekPosition": fifty_two_week_position,
                    "currentPrice": current_price,
                    "volume": recent_volume,
                    "avgVolume10D": avg_volume_10d,
                    "avgVolume3M": avg_volume_3m,
                    "warnings": warnings
                }
                
            except Exception as e:
                print(f"Failed to fetch technicals for {symbol}: {e}")
                return None

        # Process concurrently
        with ThreadPoolExecutor(max_workers=min(len(symbols), 10)) as executor:
            futures = [executor.submit(fetch_technicals, sym) for sym in symbols]
            for future in futures:
                res = future.result()
                if res is not None:
                    results.append(res)
                    
        return results

technical_service = TechnicalService()
