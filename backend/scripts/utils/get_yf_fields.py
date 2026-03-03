import yfinance as yf
import json

ticker = yf.Ticker("MSFT")
info = ticker.info

print("--- ALL KEYS IN INFO ---")
keys = sorted(list(info.keys()))
for k in keys:
    print(k)

print("\n--- FAST INFO ---")
for k in ticker.fast_info.keys():
    print(k)

