import yfinance as yf
import pandas as pd
import numpy as np
from typing import Dict, Any

class StrategyService:
    def get_signals(self, symbol: str) -> Dict[str, Any]:
        try:
            # Get 1 year of history to calculate SMAs
            ticker = yf.Ticker(symbol)
            df = ticker.history(period="1y")
            
            if df.empty:
                return {"error": "No data found"}
            
            # --- Calculations ---
            
            # 1. RSI (14)
            # RSI Formula: 100 - (100 / (1 + RS))
            delta = df['Close'].diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
            rs = gain / loss
            rsi_series = 100 - (100 / (1 + rs))
            current_rsi = rsi_series.iloc[-1]
            
            # 2. SMA (20, 50, 200)
            sma_20 = df['Close'].rolling(window=20).mean().iloc[-1]
            sma_50 = df['Close'].rolling(window=50).mean().iloc[-1]
            sma_200 = df['Close'].rolling(window=200).mean().iloc[-1]
            
            current_price = df['Close'].iloc[-1]
            
            # --- Logic / Suggestion ---
            signal = "HOLD"
            reason = "Neutral conditions."
            action_type = "WAIT" # BUY, SELL, WAIT, ADD, TRIM
            
            # Condition 1: Oversold (RSI < 30) -> Potential Entry
            if current_rsi < 30:
                signal = "OVERSOLD"
                action_type = "BUY"
                reason = f"RSI is {current_rsi:.1f} (Aggressively Oversold). Potential reversal point."
            
            # Condition 2: Strong Uptrend Pullback (Price > SMA200 but < SMA20) -> Add
            elif current_price > sma_200 and current_price < sma_20:
                signal = "PULLBACK"
                action_type = "ADD"
                reason = "Price pulled back to short-term average in a long-term uptrend."
                
            # Condition 3: Overbought (RSI > 70) -> Trim
            elif current_rsi > 70:
                signal = "OVERBOUGHT"
                action_type = "TRIM"
                reason = f"RSI is {current_rsi:.1f}. Market may be overheated."
                
            # Condition 4: Golden Cross (SMA50 crosses above SMA200) - Recent history check needed, skipping for now complexity.
            # Simple Trend Check
            elif current_price > sma_50 and current_price > sma_200:
                 if current_rsi < 60:
                     signal = "UPTREND"
                     action_type = "BUY"
                     reason = "Confirmed uptrend with room to run."
            
            elif current_price < sma_200:
                signal = "DOWNTREND"
                action_type = "WAIT"
                reason = "Price below 200-day moving average. Bearish territory."

            return {
                "symbol": symbol,
                "price": current_price,
                "indicators": {
                    "rsi": round(current_rsi, 2),
                    "sma20": round(sma_20, 2),
                    "sma50": round(sma_50, 2),
                    "sma200": round(sma_200, 2)
                },
                "analysis": {
                    "signal": signal,
                    "action": action_type,
                    "reason": reason
                }
            }
            
        except Exception as e:
            print(f"Error calculating strategy for {symbol}: {e}")
            return {"error": str(e)}

strategy_service = StrategyService()
