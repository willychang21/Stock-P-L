import yfinance as yf
import httpx
import time
import math
from datetime import datetime
from typing import Any, Dict, List, Optional
from concurrent.futures import ThreadPoolExecutor
from app.db.session import db
from app.schemas.screener import ScreenerStock
from app.services.industry_valuation import compute_valuation_scores, get_valuation_score_for_symbol

class ScreenerService:
    _sync_in_progress = False
    _sync_progress: Dict[str, Any] = {
        "is_running": False,
        "total": 0,
        "processed": 0,
        "success": 0,
        "failed": 0,
        "started_at": None,
        "completed_at": None,
    }

    @staticmethod
    async def get_all_us_tickers() -> List[str]:
        """Fetch a comprehensive list of US stock tickers from a public source."""
        url = "https://raw.githubusercontent.com/rreichel3/US-Stock-Symbols/main/all/all_tickers.txt"
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(url)
                if response.status_code == 200:
                    tickers = [t.strip().upper() for t in response.text.splitlines() if t.strip()]
                    return sorted(list(set(tickers)))
        except Exception as e:
            print(f"⚠️ Error fetching ticker list: {e}")
        return ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "NVDA", "BRK-B", "V", "JNJ"]

    @classmethod
    async def check_and_trigger_sync(cls):
        """Intelligently syncs only stale or missing tickers."""
        if cls._sync_in_progress:
            return

        conn = db.get_connection()
        try:
            today = datetime.now().date()
            
            # Get all external tickers
            all_tickers = await cls.get_all_us_tickers()
            
            # Fetch existing state from DB
            db_data = conn.execute("SELECT symbol, updated_at, market_cap FROM screener_data").fetchall()
            
            # Map existing state
            db_state = {}
            for row in db_data:
                symbol, updated_at, mcap = row[0], row[1], row[2]
                db_state[symbol] = {
                    "updated_at": updated_at.date() if updated_at else None,
                    "market_cap": mcap or 0
                }
            
            # Determine which tickers actually need a sync
            tickers_to_sync = []
            for ticker in all_tickers:
                state = db_state.get(ticker)
                # Sync if: not in DB OR updated before today
                if not state or state["updated_at"] < today:
                    tickers_to_sync.append(ticker)
            
            if not tickers_to_sync:
                print(f"✅ All {len(all_tickers)} US stocks are up to date for today.")
                return

            print(f"🔄 Delta Sync triggered: {len(tickers_to_sync)} tickers need updating.")
            
            # Sort the queue by known market cap (largest first) to provide immediate value
            tickers_to_sync.sort(
                key=lambda x: db_state.get(x, {}).get("market_cap", 0), 
                reverse=True
            )
            
            import threading
            thread = threading.Thread(target=cls.sync_universe, args=(tickers_to_sync,))
            thread.daemon = True
            thread.start()
            
        except Exception as e:
            print(f"⚠️ Error in sync orchestration: {e}")
        finally:
            conn.close()

    @classmethod
    def _normalize_percent(raw_value: Optional[float]) -> Optional[float]:
        if raw_value is None:
            return None
        return raw_value / 100 if raw_value > 1 else raw_value

    @staticmethod
    def _normalize_dividend_yield(raw_value: Optional[float]) -> Optional[float]:
        """Yahoo may return dividend yield as either decimal (0.021) or percent (2.1)."""
        if raw_value is None:
            return None
        # Treat 0-1 as decimal already; convert common percentage format (1-100).
        if 1 < raw_value <= 100:
            return raw_value / 100
        return raw_value

    @staticmethod
    def _to_float(value: Any) -> Optional[float]:
        if value is None:
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    @classmethod
    def get_sync_status(cls) -> Dict[str, Any]:
        return dict(cls._sync_progress)

    @classmethod
    def sync_universe(cls, tickers: List[str]):
        """Executes the fetch queue efficiently using a worker pool."""
        if cls._sync_in_progress: return
        cls._sync_in_progress = True
        cls._sync_progress = {
            "is_running": True,
            "total": len(tickers),
            "processed": 0,
            "success": 0,
            "failed": 0,
            "started_at": datetime.now(),
            "completed_at": None,
        }
        
        try:
            total_tickers = len(tickers)
            print(f"🚀 Starting background sync worker for {total_tickers} tickers...")
            start_time = time.time()
            
            import requests
            session = requests.Session()
            session.headers.update({"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"})

            def fetch_and_save(symbol):
                try:
                    ticker = yf.Ticker(symbol, session=session)
                    info = ticker.info
                    fast_info = ticker.fast_info or {}
                    
                    # Validate payload
                    if not info or len(info) < 5: 
                        return False

                    # Extract basic info
                    name = info.get("shortName") or info.get("longName") or symbol
                    price = (
                        info.get("currentPrice")
                        or info.get("regularMarketPrice")
                        or info.get("previousClose")
                        or fast_info.get("lastPrice")
                        or fast_info.get("regularMarketPreviousClose")
                    )
                    market_cap = info.get("marketCap") or fast_info.get("marketCap")
                    
                    # Ratios
                    trailing_pe = info.get("trailingPE")
                    forward_pe = info.get("forwardPE")
                    ps = info.get("priceToSalesTrailing12Months") or info.get("priceToSales")
                    pb = info.get("priceToBook")
                    peg = info.get("trailingPegRatio") or info.get("pegRatio")
                    
                    # Profitability
                    roe = cls._normalize_percent(
                        info.get("returnOnEquity") or info.get("returnOnEquityTrailing12Months")
                    )
                    roa = info.get("returnOnAssets")
                    
                    rev_growth = info.get("revenueGrowth")
                    eps_growth = info.get("earningsQuarterlyGrowth") or info.get("earningsGrowth")

                    if rev_growth is None or eps_growth is None:
                        try:
                            income_stmt = ticker.quarterly_income_stmt
                            if income_stmt is not None and not income_stmt.empty and income_stmt.shape[1] >= 2:
                                latest = income_stmt.iloc[:, 0]
                                prev = income_stmt.iloc[:, 1]
                                latest_revenue = cls._to_float(
                                    latest.get("Total Revenue") or latest.get("Operating Revenue")
                                )
                                prev_revenue = cls._to_float(
                                    prev.get("Total Revenue") or prev.get("Operating Revenue")
                                )
                                latest_net_income = cls._to_float(
                                    latest.get("Net Income") or latest.get("Net Income Common Stockholders")
                                )
                                prev_net_income = cls._to_float(
                                    prev.get("Net Income") or prev.get("Net Income Common Stockholders")
                                )

                                if rev_growth is None and latest_revenue and prev_revenue:
                                    rev_growth = (latest_revenue - prev_revenue) / abs(prev_revenue)
                                if eps_growth is None and latest_net_income and prev_net_income:
                                    eps_growth = (latest_net_income - prev_net_income) / abs(prev_net_income)
                        except Exception:
                            pass
                    
                    # Dividends & Price Ranges
                    div_yield = cls._normalize_dividend_yield(info.get("dividendYield"))
                    payout = info.get("payoutRatio")
                    h52 = (
                        info.get("fiftyTwoWeekHigh")
                        or fast_info.get("yearHigh")
                        or fast_info.get("fiftyTwoWeekHigh")
                    )
                    l52 = (
                        info.get("fiftyTwoWeekLow")
                        or fast_info.get("yearLow")
                        or fast_info.get("fiftyTwoWeekLow")
                    )
                    
                    # Sentiment and Momentum
                    recommendation_mean = info.get("recommendationMean")
                    target_mean_price = info.get("targetMeanPrice")
                    
                    # Fallback for recommendation and targets if missing from info
                    if recommendation_mean is None or target_mean_price is None:
                        try:
                            analyst_targets = ticker.analyst_price_targets
                            if analyst_targets is not None:
                                target_mean_price = target_mean_price or analyst_targets.get('mean')
                        except Exception:
                            pass

                    if recommendation_mean is None:
                        try:
                            rec_summary = ticker.recommendations_summary
                            if rec_summary is not None:
                                if hasattr(rec_summary, "to_dict"):
                                    summary_dict = rec_summary.to_dict()
                                    recommendation_mean = (
                                        summary_dict.get("mean")
                                        or summary_dict.get("recommendationMean")
                                    )
                                elif isinstance(rec_summary, dict):
                                    recommendation_mean = (
                                        rec_summary.get("mean")
                                        or rec_summary.get("recommendationMean")
                                    )
                        except Exception:
                            pass

                    target_upside = None
                    if target_mean_price and price and price > 0:
                        target_upside = (target_mean_price - price) / price
                    
                    short_percent = info.get("shortPercentOfFloat")
                    inst_own_percent = info.get("heldPercentInstitutions")
                    insider_own_percent = info.get("heldPercentInsiders")
                    
                    # Fallback for ownership data using explicit holder modules
                    if inst_own_percent is None or insider_own_percent is None:
                        try:
                            maj_holders = ticker.major_holders
                            if maj_holders is not None and not maj_holders.empty:
                                for _, row in maj_holders.iterrows():
                                    val = row[0]
                                    label = str(row[1])
                                    if 'Institutions' in label:
                                        inst_own_percent = float(str(val).strip('%'))/100 if isinstance(val, str) else val
                                    if 'Insiders' in label:
                                        insider_own_percent = float(str(val).strip('%'))/100 if isinstance(val, str) else val
                        except: pass
                        
                    beta = info.get("beta")
                    gross_margin = info.get("grossMargins")
                    ebitda_margin = info.get("ebitdaMargins")
                    
                    # Free Cash Flow & P/FCF
                    fcf = info.get("freeCashflow")
                    if fcf is None:
                        try:
                            cashflow = ticker.cashflow
                            if cashflow is not None and not cashflow.empty:
                                latest_cf = cashflow.iloc[:, 0]
                                fcf = latest_cf.get("Free Cash Flow")
                        except Exception:
                            pass
                    p_fcf = None
                    fcf_val = cls._to_float(fcf)
                    mcap_val = cls._to_float(market_cap)
                    if fcf_val is not None and mcap_val is not None and fcf_val > 0:
                        p_fcf = mcap_val / fcf_val

                    # Balance Sheet Components for ROIC
                    total_debt = info.get("totalDebt")
                    total_cash = info.get("totalCash")
                    total_equity = info.get("totalEquity") or info.get("totalStockholderEquity")
                    
                    # Deep fetch if critical financial data is missing (only for mid/large caps to save time)
                    if (market_cap and market_cap > 10000000000) and (total_equity is None or total_debt is None):
                        try:
                            bs = ticker.balance_sheet
                            if not bs.empty:
                                latest = bs.iloc[:, 0]
                                total_equity = total_equity or latest.get("Stockholders Equity") or latest.get("Total Stockholder Equity") or latest.get("Common Stock Equity")
                                total_debt = total_debt or latest.get("Total Debt") or latest.get("Long Term Debt")
                                total_cash = total_cash or latest.get("Cash And Cash Equivalents")
                        except: pass

                    # ROIC Calculation
                    op_inc = info.get("operatingIncome") or info.get("ebitda")
                    if op_inc is None and info.get("operatingMargins") and info.get("totalRevenue"):
                        op_inc = info.get("operatingMargins") * info.get("totalRevenue")
                    
                    roic = None
                    if op_inc and total_equity:
                        invested_cap = (total_debt or 0) + total_equity - (total_cash or 0)
                        denom = invested_cap if invested_cap > (total_equity * 0.2) else total_equity
                        roic = (op_inc * 0.79) / denom

                    # Persist to DB
                    conn = db.get_connection()
                    try:
                        has_options = False
                        try:
                            has_options = len(ticker.options) > 0
                        except Exception:
                            pass

                        conn.execute("""
                            INSERT OR REPLACE INTO screener_data (
                                symbol, name, price, market_cap, trailing_pe, forward_pe, 
                                price_to_sales, price_to_book, ev_to_ebitda, ev_to_revenue, 
                                peg_ratio, profit_margin, operating_margin, roe, roa, 
                                revenue_growth, earnings_growth, eps_growth, dividend_yield, payout_ratio, 
                                debt_to_equity, current_ratio, fifty_day_sma, two_hundred_day_sma, 
                                fifty_two_week_high, fifty_two_week_low, price_to_fcf,
                                free_cash_flow, roic, total_debt, total_equity, total_cash, 
                                operating_income, tax_rate, target_upside, recommendation_mean, 
                                short_percent, inst_own_percent, insider_own_percent, beta, gross_margin, ebitda_margin, 
                                has_options, sector, industry, updated_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, [
                            symbol.upper(), name, float(price) if price else None, market_cap, trailing_pe, forward_pe,
                            ps, pb, info.get("enterpriseToEbitda"), info.get("enterpriseToRevenue"),
                            peg, info.get("profitMargins"), info.get("operatingMargins"), roe, roa,
                            rev_growth, info.get("earningsQuarterlyGrowth"), eps_growth, div_yield, payout,
                            info.get("debtToEquity"), info.get("currentRatio"), info.get("fiftyDayAverage"), info.get("twoHundredDayAverage"),
                            h52, l52, p_fcf,
                            fcf, roic, total_debt, total_equity, total_cash, op_inc, 0.21,
                            target_upside, recommendation_mean, short_percent, inst_own_percent, insider_own_percent, beta, gross_margin, ebitda_margin,
                            has_options, info.get("sector"), info.get("industry"), datetime.now()
                        ])
                    finally: 
                        conn.close()
                    return True
                except Exception as e:
                    if "Rate limited" in str(e):
                        print(f"🛑 Rate limited. Applying backoff...")
                        time.sleep(30)
                    return False

            # Batch processing to manage memory and API thresholds
            processed = 0
            chunk_size = 10
            
            for i in range(0, total_tickers, chunk_size):
                chunk = tickers[i:i+chunk_size]
                
                with ThreadPoolExecutor(max_workers=10) as executor:
                    results = list(executor.map(fetch_and_save, chunk))
                
                processed += len(chunk)
                cls._sync_progress["processed"] = processed
                cls._sync_progress["success"] = cls._sync_progress["success"] + sum(1 for ok in results if ok)
                cls._sync_progress["failed"] = cls._sync_progress["failed"] + sum(1 for ok in results if not ok)
                if processed % 50 == 0 or processed == total_tickers:
                    print(f"📊 Sync Progress: {processed}/{total_tickers} ({(processed/total_tickers)*100:.1f}%)")
                
                # Baseline delay to maintain healthy API usage
                time.sleep(2)
                
            print(f"✅ Sync run completed in {time.time() - start_time:.1f}s")
        finally: 
            cls._sync_in_progress = False
            cls._sync_progress["is_running"] = False
            cls._sync_progress["completed_at"] = datetime.now()

    @staticmethod
    def get_screener_stocks(
        min_mkt_cap: Optional[float] = None, max_mkt_cap: Optional[float] = None,
        min_pe: Optional[float] = None, max_pe: Optional[float] = None,
        min_ps: Optional[float] = None, max_ps: Optional[float] = None,
        min_pb: Optional[float] = None, max_pb: Optional[float] = None,
        min_peg: Optional[float] = None, max_peg: Optional[float] = None,
        min_roe: Optional[float] = None, max_roe: Optional[float] = None,
        min_roic: Optional[float] = None, max_roic: Optional[float] = None,
        min_profit_margin: Optional[float] = None, max_profit_margin: Optional[float] = None,
        min_revenue_growth: Optional[float] = None, max_revenue_growth: Optional[float] = None,
        min_eps_growth: Optional[float] = None, max_eps_growth: Optional[float] = None,
        min_fcf: Optional[float] = None, max_fcf: Optional[float] = None,
        min_target_upside: Optional[float] = None, max_target_upside: Optional[float] = None,
        min_recommendation_mean: Optional[float] = None, max_recommendation_mean: Optional[float] = None,
        min_short_percent: Optional[float] = None, max_short_percent: Optional[float] = None,
        min_inst_own: Optional[float] = None, max_inst_own: Optional[float] = None,
        min_insider_own: Optional[float] = None, max_insider_own: Optional[float] = None,
        min_beta: Optional[float] = None, max_beta: Optional[float] = None,
        min_gross_margin: Optional[float] = None, max_gross_margin: Optional[float] = None,
        min_ebitda_margin: Optional[float] = None, max_ebitda_margin: Optional[float] = None,
        has_options: Optional[bool] = None, sector: Optional[str] = None,
        only_holdings: bool = False,
        sort_by: str = "market_cap", sort_order: str = "desc",
        limit: int = 100, offset: int = 0
    ) -> dict:
        conn = db.get_connection()
        try:
            cols = [
                "symbol", "name", "price", "market_cap", "trailing_pe", "forward_pe", "price_to_sales", "price_to_book",
                "ev_to_ebitda", "ev_to_revenue", "peg_ratio", "profit_margin", "operating_margin", "roe", "roa",
                "revenue_growth", "earnings_growth", "eps_growth", "dividend_yield", "payout_ratio", "debt_to_equity",
                "current_ratio", "fifty_day_sma", "two_hundred_day_sma", "fifty_two_week_high", "fifty_two_week_low",
                "price_to_fcf", "free_cash_flow", "roic", "total_debt",
                "total_equity", "total_cash", "operating_income", "tax_rate",
                "target_upside", "recommendation_mean", "short_percent", "inst_own_percent", "insider_own_percent",
                "beta", "gross_margin", "ebitda_margin",
                "has_options", "sector", "industry", "updated_at"
            ]
            query = f"SELECT {', '.join(cols)} FROM screener_data WHERE 1=1"
            params = []
            
            if only_holdings:
                from app.services.portfolio_service import portfolio_service
                symbols = portfolio_service.get_holding_symbols()
                if symbols:
                    placeholders = ', '.join(['?'] * len(symbols))
                    query += f" AND symbol IN ({placeholders})"
                    params.extend(symbols)
                else:
                    # No holdings, return empty result
                    return {"total": 0, "items": []}

            normalized_sector = sector.strip() if isinstance(sector, str) else sector

            f_map = [
                ("market_cap", ">=", min_mkt_cap), ("market_cap", "<=", max_mkt_cap),
                ("trailing_pe", ">=", min_pe), ("trailing_pe", "<=", max_pe),
                ("price_to_sales", ">=", min_ps), ("price_to_sales", "<=", max_ps),
                ("price_to_book", ">=", min_pb), ("price_to_book", "<=", max_pb),
                ("peg_ratio", ">=", min_peg), ("peg_ratio", "<=", max_peg),
                ("roe", ">=", min_roe), ("roe", "<=", max_roe),
                ("roic", ">=", min_roic), ("roic", "<=", max_roic),
                ("profit_margin", ">=", min_profit_margin), ("profit_margin", "<=", max_profit_margin),
                ("revenue_growth", ">=", min_revenue_growth), ("revenue_growth", "<=", max_revenue_growth),
                ("eps_growth", ">=", min_eps_growth), ("eps_growth", "<=", max_eps_growth),
                ("free_cash_flow", ">=", min_fcf), ("free_cash_flow", "<=", max_fcf),
                ("target_upside", ">=", min_target_upside), ("target_upside", "<=", max_target_upside),
                ("recommendation_mean", ">=", min_recommendation_mean), ("recommendation_mean", "<=", max_recommendation_mean),
                ("short_percent", ">=", min_short_percent), ("short_percent", "<=", max_short_percent),
                ("inst_own_percent", ">=", min_inst_own), ("inst_own_percent", "<=", max_inst_own),
                ("insider_own_percent", ">=", min_insider_own), ("insider_own_percent", "<=", max_insider_own),
                ("beta", ">=", min_beta), ("beta", "<=", max_beta),
                ("gross_margin", ">=", min_gross_margin), ("gross_margin", "<=", max_gross_margin),
                ("ebitda_margin", ">=", min_ebitda_margin), ("ebitda_margin", "<=", max_ebitda_margin),
                ("has_options", "=", has_options)
            ]
            for col, op, val in f_map:
                if val is not None:
                    query += f" AND {col} {op} ?"
                    params.append(val)
            if normalized_sector:
                query += " AND lower(sector) = lower(?)"
                params.append(normalized_sector)
            
            total = conn.execute(f"SELECT COUNT(*) FROM ({query})", params).fetchone()[0]
            s_cols = cols
            if sort_by not in s_cols: sort_by = "market_cap"
            query += f" ORDER BY {sort_by} {'DESC' if sort_order.lower() == 'desc' else 'ASC'} NULLS LAST LIMIT ? OFFSET ?"
            params.extend([limit, offset])
            
            rows = conn.execute(query, params).fetchall()
            
            # Helper to sanitize floats for JSON (convert NaN/Inf to None)
            import math
            def sanitize(val):
                if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
                    return None
                return val

            items = []
            raw_dicts: List[Dict[str, Any]] = []
            for row in rows:
                data = dict(zip(cols, row))
                data["dividend_yield"] = ScreenerService._normalize_dividend_yield(data.get("dividend_yield"))
                if data.get("price_to_fcf") is None:
                    fcf_val = ScreenerService._to_float(data.get("free_cash_flow"))
                    mcap_val = ScreenerService._to_float(data.get("market_cap"))
                    if fcf_val is not None and mcap_val is not None and fcf_val > 0:
                        data["price_to_fcf"] = mcap_val / fcf_val
                sanitized_data = {k: sanitize(v) for k, v in data.items()}
                raw_dicts.append(sanitized_data)

            # Compute industry-aware valuation scores across all returned rows
            val_scores = compute_valuation_scores(raw_dicts)

            for d in raw_dicts:
                sym = d.get("symbol", "")
                result = val_scores.get(sym)
                if result:
                    d["valuation_score"] = result["score"]
                    d["valuation_label"] = result["label"]
                    d["valuation_low_confidence"] = result["low_confidence"]
                items.append(ScreenerStock(**d))
                
            return {"total": total, "items": items}
        finally:
            conn.close()

    @staticmethod
    def get_top_ideas(limit: int = 5) -> dict:
        """Find best stocks currently: combination of high ROIC, growth and low PE or high target upside."""
        conn = db.get_connection()
        try:
            cols = [
                "symbol", "name", "price", "market_cap", "trailing_pe", "roic", "revenue_growth", "target_upside", "sector"
            ]
            # Scoring logic: ROIC > 15%, Revenue Growth > 10%, Positive Upside
            query = f"""
                SELECT {', '.join(cols)} FROM screener_data 
                WHERE roic > 0.15 
                AND revenue_growth > 0.1 
                AND trailing_pe < 40 
                AND market_cap > 1000000000
                ORDER BY (target_upside * 0.4 + roic * 0.4 + revenue_growth * 0.2) DESC 
                LIMIT ?
            """
            rows = conn.execute(query, [limit]).fetchall()
            items = [dict(zip(cols, row)) for row in rows]
            return {"items": items}
        finally:
            conn.close()

    @classmethod
    def get_symbol_insights(cls, symbol: str) -> Dict[str, Any]:
        """Fetch on-demand live yfinance insights for a single symbol."""
        ticker = yf.Ticker(symbol.upper())
        info = ticker.info or {}
        fast_info = ticker.fast_info or {}

        last_price = (
            info.get("currentPrice")
            or info.get("regularMarketPrice")
            or fast_info.get("lastPrice")
            or fast_info.get("regularMarketPreviousClose")
        )

        year_high = (
            info.get("fiftyTwoWeekHigh")
            or fast_info.get("yearHigh")
            or fast_info.get("fiftyTwoWeekHigh")
        )
        year_low = (
            info.get("fiftyTwoWeekLow")
            or fast_info.get("yearLow")
            or fast_info.get("fiftyTwoWeekLow")
        )

        analyst_targets = {}
        try:
            raw_targets = ticker.analyst_price_targets
            if raw_targets:
                analyst_targets = dict(raw_targets)
        except Exception:
            analyst_targets = {}

        recommendations = {}
        try:
            rec_summary = ticker.recommendations_summary
            if rec_summary is not None and hasattr(rec_summary, "to_dict"):
                recommendations = rec_summary.to_dict()
        except Exception:
            recommendations = {}

        next_earnings = None
        try:
            cal = ticker.calendar
            if cal is not None:
                if hasattr(cal, "index") and len(cal.index) > 0:
                    idx = str(cal.index[0]).lower()
                    if "earnings" in idx:
                        val = cal.iloc[0, 0] if hasattr(cal, "iloc") else None
                        next_earnings = str(val) if val is not None else None
                elif isinstance(cal, dict):
                    next_earnings = (
                        cal.get("Earnings Date")
                        or cal.get("earningsDate")
                        or cal.get("Next Earnings Date")
                    )
        except Exception:
            next_earnings = None

        one_month_return = None
        three_month_return = None
        rsi_14 = None
        annual_volatility = None
        price_series_30d: List[Dict[str, Any]] = []
        price_series_90d: List[Dict[str, Any]] = []
        distance_to_52w_high = None
        distance_to_52w_low = None
        avg_volume_20d = None
        latest_volume = None
        volume_ratio_20d = None
        avg_dollar_volume_20d = None
        try:
            hist = ticker.history(period="6mo", interval="1d")
            if hist is not None and not hist.empty and "Close" in hist.columns:
                closes = hist["Close"].dropna()
                if len(closes) >= 2:
                    latest = float(closes.iloc[-1])
                    one_month_back_idx = max(len(closes) - 22, 0)
                    three_month_back_idx = max(len(closes) - 66, 0)
                    one_month_back = float(closes.iloc[one_month_back_idx])
                    three_month_back = float(closes.iloc[three_month_back_idx])
                    if one_month_back > 0:
                        one_month_return = (latest - one_month_back) / one_month_back
                    if three_month_back > 0:
                        three_month_return = (latest - three_month_back) / three_month_back

                    if year_high and year_high > 0:
                        distance_to_52w_high = (latest - float(year_high)) / float(year_high)
                    if year_low and year_low > 0:
                        distance_to_52w_low = (latest - float(year_low)) / float(year_low)

                returns = closes.pct_change().dropna()
                if len(returns) >= 14:
                    annual_volatility = float(returns.std() * math.sqrt(252))
                    delta = closes.diff().dropna()
                    gain = delta.clip(lower=0).rolling(14).mean()
                    loss = (-delta.clip(upper=0)).rolling(14).mean()
                    rs = gain / loss.replace(0, math.nan)
                    rsi_series = 100 - (100 / (1 + rs))
                    if not rsi_series.empty:
                        rsi_14 = float(rsi_series.iloc[-1])

                hist_30d = closes.tail(30)
                price_series_30d = [
                    {
                        "date": idx.strftime("%Y-%m-%d") if hasattr(idx, "strftime") else str(idx),
                        "close": cls._to_float(val),
                    }
                    for idx, val in hist_30d.items()
                ]

                hist_90d = closes.tail(90)
                price_series_90d = [
                    {
                        "date": idx.strftime("%Y-%m-%d") if hasattr(idx, "strftime") else str(idx),
                        "close": cls._to_float(val),
                    }
                    for idx, val in hist_90d.items()
                ]

                if "Volume" in hist.columns:
                    volume = hist["Volume"].dropna()
                    if not volume.empty:
                        latest_volume = cls._to_float(volume.iloc[-1])
                        avg_volume_20d = cls._to_float(volume.tail(20).mean())
                        if avg_volume_20d and avg_volume_20d > 0 and latest_volume is not None:
                            volume_ratio_20d = latest_volume / avg_volume_20d
                    if "Close" in hist.columns:
                        dv = (hist["Close"] * hist["Volume"]).dropna()
                        if not dv.empty:
                            avg_dollar_volume_20d = cls._to_float(dv.tail(20).mean())
        except Exception:
            pass

        news_items: List[Dict[str, Any]] = []
        try:
            news = ticker.news or []
            for n in news[:5]:
                if not isinstance(n, dict):
                    continue
                title = n.get("title")
                link = n.get("link")
                provider = n.get("publisher")
                publish_ts = n.get("providerPublishTime")
                published_at = None
                try:
                    if publish_ts is not None:
                        published_at = datetime.fromtimestamp(int(publish_ts)).isoformat()
                except Exception:
                    published_at = None
                if title and link:
                    news_items.append(
                        {
                            "title": title,
                            "link": link,
                            "provider": provider,
                            "published_at": published_at,
                        }
                    )
        except Exception:
            news_items = []

        return {
            "symbol": symbol.upper(),
            "name": info.get("shortName") or info.get("longName") or symbol.upper(),
            "price": cls._to_float(last_price),
            "market_cap": cls._to_float(info.get("marketCap") or fast_info.get("marketCap")),
            "year_high": cls._to_float(year_high),
            "year_low": cls._to_float(year_low),
            "forward_pe": cls._to_float(info.get("forwardPE")),
            "trailing_pe": cls._to_float(info.get("trailingPE")),
            "peg_ratio": cls._to_float(info.get("pegRatio") or info.get("trailingPegRatio")),
            "beta": cls._to_float(info.get("beta")),
            "revenue_growth": cls._to_float(info.get("revenueGrowth")),
            "eps_growth": cls._to_float(info.get("earningsQuarterlyGrowth") or info.get("earningsGrowth")),
            "free_cash_flow": cls._to_float(info.get("freeCashflow")),
            "profit_margin": cls._to_float(info.get("profitMargins")),
            "gross_margin": cls._to_float(info.get("grossMargins")),
            "ebitda_margin": cls._to_float(info.get("ebitdaMargins")),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "target_current": cls._to_float(analyst_targets.get("current")),
            "target_mean": cls._to_float(analyst_targets.get("mean")),
            "target_low": cls._to_float(analyst_targets.get("low")),
            "target_high": cls._to_float(analyst_targets.get("high")),
            "recommendation_mean": cls._to_float(info.get("recommendationMean")),
            "recommendations_summary": recommendations,
            "next_earnings": next_earnings,
            "one_month_return": cls._to_float(one_month_return),
            "three_month_return": cls._to_float(three_month_return),
            "rsi_14": cls._to_float(rsi_14),
            "annual_volatility": cls._to_float(annual_volatility),
            "distance_to_52w_high": cls._to_float(distance_to_52w_high),
            "distance_to_52w_low": cls._to_float(distance_to_52w_low),
            "avg_volume_20d": cls._to_float(avg_volume_20d),
            "latest_volume": cls._to_float(latest_volume),
            "volume_ratio_20d": cls._to_float(volume_ratio_20d),
            "avg_dollar_volume_20d": cls._to_float(avg_dollar_volume_20d),
            "price_series_30d": price_series_30d,
            "price_series_90d": price_series_90d,
            "news": news_items,
            "updated_at": datetime.now().isoformat(),
        }

    @classmethod
    def get_market_pulse(cls) -> Dict[str, Any]:
        """Lightweight market regime snapshot from yfinance."""
        symbols = ["SPY", "QQQ", "^VIX"]
        data = yf.download(
            tickers=symbols,
            period="1mo",
            interval="1d",
            auto_adjust=False,
            progress=False,
            group_by="ticker",
            threads=True,
        )

        def calc_change(sym: str, days: int) -> Optional[float]:
            try:
                closes = data[sym]["Close"].dropna()
                if len(closes) < days + 1:
                    return None
                latest = float(closes.iloc[-1])
                prev = float(closes.iloc[-(days + 1)])
                if prev == 0:
                    return None
                return (latest - prev) / prev
            except Exception:
                return None

        spy_5d = calc_change("SPY", 5)
        qqq_5d = calc_change("QQQ", 5)
        vix_5d = calc_change("^VIX", 5)

        regime = "Neutral"
        if spy_5d is not None and qqq_5d is not None and vix_5d is not None:
            if spy_5d > 0 and qqq_5d > 0 and vix_5d < 0:
                regime = "Risk On"
            elif spy_5d < 0 and qqq_5d < 0 and vix_5d > 0:
                regime = "Risk Off"

        latest_vix = None
        try:
            latest_vix = float(data["^VIX"]["Close"].dropna().iloc[-1])
        except Exception:
            latest_vix = None

        return {
            "spy_5d": cls._to_float(spy_5d),
            "qqq_5d": cls._to_float(qqq_5d),
            "vix_5d": cls._to_float(vix_5d),
            "vix_level": cls._to_float(latest_vix),
            "regime": regime,
            "updated_at": datetime.now().isoformat(),
        }
