import yfinance as yf
try:
    # See if yfinance has a screener or how to get options
    msft = yf.Ticker("MSFT")
    print(msft.info.get("marketCap"))
    print(msft.info.get("trailingPE"))
    print(len(msft.options) > 0)
except Exception as e:
    print("Error:", e)
