import yfinance as yf
import json

tickers = ["AAPL", "NVDA", "JNJ", "JPM"]
results = {}

for sym in tickers:
    t = yf.Ticker(sym)
    
    # 測試各個模組
    fast_info = list(t.fast_info.keys()) if hasattr(t, 'fast_info') else []
    
    # 財務報表 (取第一欄)
    try:
        inc_stmt = list(t.income_stmt.index) if not t.income_stmt.empty else []
    except: inc_stmt = []
    
    try:
        bs = list(t.balance_sheet.index) if not t.balance_sheet.empty else []
    except: bs = []
    
    try:
        cf = list(t.cashflow.index) if not t.cashflow.empty else []
    except: cf = []
    
    # 分析師與推薦
    try:
        rec_summary = t.recommendations_summary.to_dict(orient='records') if t.recommendations_summary is not None and not t.recommendations_summary.empty else []
    except: rec_summary = []
    
    try:
        analyst_targets = t.analyst_price_targets if t.analyst_price_targets else {}
    except: analyst_targets = {}
    
    # 持股與內部人士
    try:
        inst_holders = list(t.institutional_holders.columns) if t.institutional_holders is not None and not t.institutional_holders.empty else []
    except: inst_holders = []
    
    try:
        insider_purchases = t.insider_purchases.to_dict(orient='records') if t.insider_purchases is not None and not t.insider_purchases.empty else []
    except: insider_purchases = []
    
    results[sym] = {
        "info_keys_count": len(t.info) if t.info else 0,
        "fast_info_keys": fast_info,
        "income_stmt_keys": inc_stmt[:5], # 取前5個看看
        "balance_sheet_keys": bs[:5],
        "cashflow_keys": cf[:5],
        "has_rec_summary": len(rec_summary) > 0,
        "analyst_targets_keys": list(analyst_targets.keys()),
        "has_inst_holders": len(inst_holders) > 0,
        "has_insider_purchases": len(insider_purchases) > 0
    }

print(json.dumps(results, indent=2))
