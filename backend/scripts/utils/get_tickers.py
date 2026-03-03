import requests
import pandas as pd
import io

def get_us_tickers():
    # Attempt to get tickers from a reliable public source
    url = "https://raw.githubusercontent.com/rreichel3/US-Stock-Symbols/main/all/all_tickers.txt"
    try:
        response = requests.get(url)
        if response.status_code == 200:
            tickers = response.text.splitlines()
            # Clean up
            tickers = [t.strip().upper() for t in tickers if t.strip()]
            return tickers
    except Exception as e:
        print(f"Error fetching tickers: {e}")
    return []

if __name__ == "__main__":
    tickers = get_us_tickers()
    print(f"Found {len(tickers)} tickers")
    print(f"First 10: {tickers[:10]}")
