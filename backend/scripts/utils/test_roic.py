import yfinance as yf
tickers = ["AAPL", "NVDA", "MSFT"]
for sym in tickers:
    t = yf.Ticker(sym)
    info = t.info
    print(f"--- {sym} ---")
    print(f"Operating Income (info): {info.get('operatingCashflow')} (Proxy?)") # Wait, I used operatingCashflow as proxy
    print(f"Total Revenue: {info.get('totalRevenue')}")
    print(f"Operating Margins: {info.get('operatingMargins')}")
    print(f"Total Debt: {info.get('totalDebt')}")
    print(f"Total Equity: {info.get('totalEquity')}")
    print(f"Total Cash: {info.get('totalCash')}")
    
    op_inc = None
    if info.get('operatingMargins') and info.get('totalRevenue'):
        op_inc = info.get('operatingMargins') * info.get('totalRevenue')
    print(f"Calculated Op Income: {op_inc}")
