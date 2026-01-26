import sys
import os
from datetime import date, datetime, timedelta

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.services.market_data import market_data_service

def test_price_logic(symbol: str, rec_date_str: str):
    print(f"--- Testing {symbol} for date {rec_date_str} ---")
    
    rec_date = datetime.strptime(rec_date_str, "%Y-%m-%d").date()
    now = datetime.now()
    initial_price = None

    # 1. Historical Fetch
    try:
        start_date = (rec_date - timedelta(days=5)).strftime("%Y-%m-%d")
        end_date = (rec_date + timedelta(days=5)).strftime("%Y-%m-%d")
        print(f"Fetching historical from {start_date} to {end_date}")
        
        hist_data = market_data_service.get_historical_prices(
            symbol, start_date, end_date
        )
        print(f"Historical Result: {hist_data}")
        
        if hist_data and hist_data.get("prices"):
            prices = hist_data["prices"]
            target_ts = datetime.combine(rec_date, datetime.min.time()).timestamp()
            
            best_match = None
            min_diff = float('inf')
            
            for p in prices:
                p_date = datetime.strptime(p['date'], "%Y-%m-%d")
                diff = abs(p_date.timestamp() - target_ts)
                print(f"  Candidate: {p['date']} (diff: {diff})")
                if diff < min_diff:
                    min_diff = diff
                    best_match = p
            
            if best_match:
                print(f"  Best match found: {best_match}")
                initial_price = best_match["close"]
            else:
                print("  No best match found")
        else:
            print("  No prices in historical data")
            
    except Exception as e:
        print(f"Historical Fetch Failed: {e}")

    # 2. Fallback Logic
    if initial_price is None:
        print("Initial price is None, trying fallback...")
        diff = (now.date() - rec_date).days
        print(f"Date Diff: {diff} days")
        
        if diff <= 3:
            try:
                print(f"Fetching live quote for {symbol}...")
                quotes = market_data_service.get_quotes([symbol])
                print(f"Live Quotes Result: {quotes}")
                
                if quotes and quotes[0].get("regularMarketPrice"):
                    initial_price = quotes[0]["regularMarketPrice"]
                    print(f"Fallback Success: {initial_price}")
                else:
                    print("Fallback Failed: No price in quote")
            except Exception as e:
                print(f"Fallback Exception: {e}")
        else:
            print("Fallback skipped: Date too old")
            
    print(f"FINAL INITIAL PRICE: {initial_price}")

if __name__ == "__main__":
    # Test with NVDA for today (simulation time)
    test_price_logic("NVDA", "2026-01-26")
