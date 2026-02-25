import yfinance as yf
from datetime import datetime, timedelta

def test():
    symbols = ['^VIX', '^TNX', 'GC=F']
    end_date = datetime.now()
    start_date = end_date - timedelta(days=30)
    for sym in symbols:
        print(f"Fetching {sym}...")
        try:
            ticker = yf.Ticker(sym)
            hist = ticker.history(start=start_date.strftime('%Y-%m-%d'), end=end_date.strftime('%Y-%m-%d'), interval="1d")
            print(f"Rows for {sym}: {len(hist)}")
            if not hist.empty:
                print(f"Latest close: {hist['Close'].iloc[-1]}")
        except Exception as e:
            print(f"Error for {sym}: {e}")
test()
