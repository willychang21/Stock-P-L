import yfinance as yf
import json

tickers = ["NVDA", "AAPL", "MSFT"]
results = {}

for sym in tickers:
    t = yf.Ticker(sym)
    info = t.info
    results[sym] = {
        "pegRatio": info.get("pegRatio"),
        "trailingPegRatio": info.get("trailingPegRatio"),
        "priceToSales": info.get("priceToSalesTrailing12Months"),
        "enterpriseToEbitda": info.get("enterpriseToEbitda"),
        "returnOnEquity": info.get("returnOnEquity"),
        "revenueGrowth": info.get("revenueGrowth"),
        "freeCashflow": info.get("freeCashflow"),
        "operatingCashflow": info.get("operatingCashflow"),
        "totalRevenue": info.get("totalRevenue"),
        "operatingMargins": info.get("operatingMargins"),
    }

print(json.dumps(results, indent=2))
