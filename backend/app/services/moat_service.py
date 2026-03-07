"""
Wall Street Deep Dive — Moat & Fundamental Analysis Service
============================================================
Fetches multi-year trend data and insider/analyst activity from yfinance.

Panels returned:
  1. moat_trends    — 3-4Y Gross Margin, FCF Margin, ROIC sparklines
  2. wacc_spread    — ROIC vs WACC (creating or destroying value?)
  3. historical_pe  — 5Y P/E percentile gauge (where does the stock sit in its own history?)
  4. insider        — Recent 180-day insider buy/sell transactions
  5. analyst        — Recent 180-day analyst upgrades/downgrades
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import yfinance as yf

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

RISK_FREE_RATE = 0.043
EQUITY_RISK_PREMIUM = 0.06


def _safe_float(v: Any) -> Optional[float]:
    try:
        if v is None:
            return None
        f = float(v)
        if math.isnan(f) or math.isinf(f):
            return None
        return f
    except (TypeError, ValueError):
        return None


def _find_row(df: Any, *keywords: str) -> Optional[str]:
    """Return first index label whose lower-case form contains all given keywords."""
    if df is None or getattr(df, "empty", True):
        return None
    for key in df.index:
        k = key.lower()
        if all(kw.lower() in k for kw in keywords):
            return key
    return None


def _find_row_any(df: Any, *keyword_groups: tuple[str, ...]) -> Optional[str]:
    """Return first index label matching any group of keywords."""
    for group in keyword_groups:
        result = _find_row(df, *group)
        if result:
            return result
    return None


def _trend_direction(values: List[Optional[float]]) -> str:
    clean = [v for v in values if v is not None]
    if len(clean) < 2:
        return "stable"
    pct = (clean[-1] - clean[0]) / abs(clean[0]) if clean[0] != 0 else 0
    if pct > 0.02:
        return "improving"
    if pct < -0.02:
        return "declining"
    return "stable"


def _extract_yearly(df: Any, numerator_key: str, denominator_key: Optional[str] = None, n: int = 4) -> List[Dict]:
    """Extract up to n annual data points (oldest first).
    If denominator_key is given, returns numerator / denominator (e.g. margin)."""
    if df is None or getattr(df, "empty", True):
        return []
    results = []
    cols = df.columns[:n]
    for col in reversed(cols):
        try:
            num = _safe_float(df.loc[numerator_key, col]) if numerator_key in df.index else None
            if denominator_key:
                den = _safe_float(df.loc[denominator_key, col]) if denominator_key in df.index else None
                val = (num / den) if (num is not None and den and abs(den) > 1e-6) else None
            else:
                val = num
            year = col.year if hasattr(col, "year") else int(str(col)[:4])
            results.append({"year": year, "value": round(val, 4) if val is not None else None})
        except Exception:
            continue
    return results


# ---------------------------------------------------------------------------
# Main service
# ---------------------------------------------------------------------------

class MoatService:

    @classmethod
    def get_moat_data(cls, symbol: str) -> Dict[str, Any]:
        symbol = symbol.strip().upper()
        ticker = yf.Ticker(symbol)

        try:
            info = ticker.info or {}
        except Exception:
            info = {}

        # Fetch statements once (reuse across panels)
        try:
            income = ticker.income_stmt
        except Exception:
            income = None
        try:
            cashflow = ticker.cashflow
        except Exception:
            cashflow = None
        try:
            balance = ticker.balance_sheet
        except Exception:
            balance = None

        moat_trends = cls._moat_trends(income, cashflow, balance)
        wacc_spread = cls._wacc_spread(income, balance, info)
        historical_pe = cls._historical_pe(ticker, info)
        insider = cls._insider_activity(ticker)
        analyst = cls._analyst_activity(ticker)

        return {
            "symbol": symbol,
            "moat_trends": moat_trends,
            "wacc_spread": wacc_spread,
            "historical_pe": historical_pe,
            "insider": insider,
            "analyst": analyst,
        }

    # ------------------------------------------------------------------
    # Panel 1 — Moat quality trends
    # ------------------------------------------------------------------

    @classmethod
    def _moat_trends(cls, income: Any, cashflow: Any, balance: Any) -> Dict[str, Any]:
        # Gross Margin
        gp_key = _find_row(income, "gross profit")
        rev_key = _find_row_any(income, ("total revenue",), ("revenue",))
        gross_margin_trend = _extract_yearly(income, gp_key, rev_key) if gp_key else []

        # FCF Margin (cashflow / income revenue — need to align by year)
        fcf_margin_trend: List[Dict] = []
        fcf_key = _find_row(cashflow, "free cash flow")
        if fcf_key and rev_key and cashflow is not None and not cashflow.empty and income is not None and not income.empty:
            for col in reversed(cashflow.columns[:4]):
                try:
                    year = col.year if hasattr(col, "year") else int(str(col)[:4])
                    fcf = _safe_float(cashflow.loc[fcf_key, col])
                    # Match income column by year
                    inc_col = next(
                        (c for c in income.columns if (c.year if hasattr(c, "year") else int(str(c)[:4])) == year),
                        None,
                    )
                    if inc_col is not None and fcf is not None:
                        rev = _safe_float(income.loc[rev_key, inc_col]) if rev_key else None
                        if rev and abs(rev) > 1e-6:
                            fcf_margin_trend.append({"year": year, "value": round(fcf / rev, 4)})
                except Exception:
                    continue

        # ROIC = NOPAT / Invested Capital
        roic_trend: List[Dict] = []
        ebit_key = _find_row_any(income, ("ebit",), ("operating income",))
        tax_key = _find_row_any(income, ("tax provision",), ("income tax",))
        pretax_key = _find_row_any(income, ("pretax income",), ("pre-tax income",))
        asset_key = _find_row(balance, "total assets")
        curr_liab_key = _find_row_any(balance, ("total current liabilities",), ("current liabilities",))
        cash_key = _find_row_any(balance, ("cash and cash equivalents",), ("cash and short term",))

        if ebit_key and asset_key and income is not None and balance is not None:
            for col in reversed(income.columns[:4]):
                try:
                    year = col.year if hasattr(col, "year") else int(str(col)[:4])
                    ebit = _safe_float(income.loc[ebit_key, col])
                    if ebit is None:
                        continue

                    # Tax rate
                    tax_rate = 0.21
                    if tax_key and pretax_key:
                        tax = _safe_float(income.loc[tax_key, col])
                        pretax = _safe_float(income.loc[pretax_key, col])
                        if tax is not None and pretax and abs(pretax) > 1e-6:
                            tax_rate = max(0.0, min(0.40, tax / pretax))

                    nopat = ebit * (1.0 - tax_rate)

                    # Match balance sheet column by year
                    bal_col = next(
                        (c for c in balance.columns if (c.year if hasattr(c, "year") else int(str(c)[:4])) == year),
                        None,
                    )
                    if bal_col is None:
                        continue

                    assets = _safe_float(balance.loc[asset_key, bal_col])
                    curr_liab = _safe_float(balance.loc[curr_liab_key, bal_col]) if curr_liab_key else 0.0
                    cash = _safe_float(balance.loc[cash_key, bal_col]) if cash_key else 0.0
                    if assets is None:
                        continue

                    ic = assets - (curr_liab or 0.0) - (cash or 0.0)
                    if ic > 0:
                        roic_trend.append({"year": year, "value": round(nopat / ic, 4)})
                except Exception:
                    continue

        return {
            "gross_margin_trend": gross_margin_trend,
            "fcf_margin_trend": fcf_margin_trend,
            "roic_trend": roic_trend,
            "trend_direction": {
                "gross_margin": _trend_direction([p["value"] for p in gross_margin_trend]),
                "fcf_margin": _trend_direction([p["value"] for p in fcf_margin_trend]),
                "roic": _trend_direction([p["value"] for p in roic_trend]),
            },
        }

    # ------------------------------------------------------------------
    # Panel 2 — ROIC vs WACC
    # ------------------------------------------------------------------

    @classmethod
    def _wacc_spread(cls, income: Any, balance: Any, info: Dict) -> Dict[str, Any]:
        beta = _safe_float(info.get("beta")) or 1.0
        beta = max(0.3, min(3.0, beta))
        ke = RISK_FREE_RATE + beta * EQUITY_RISK_PREMIUM
        ke = max(0.06, min(0.16, ke))

        market_cap = _safe_float(info.get("marketCap")) or 0.0
        total_debt = _safe_float(info.get("totalDebt")) or 0.0

        # Cost of debt
        kd = 0.05
        if income is not None and not income.empty and total_debt > 0:
            int_key = _find_row(income, "interest expense")
            if int_key:
                try:
                    int_exp = abs(_safe_float(income.loc[int_key, income.columns[0]]) or 0.0)
                    kd = min(0.15, int_exp / total_debt)
                except Exception:
                    pass

        # Tax rate from latest year
        tax_rate = 0.21
        if income is not None and not income.empty:
            tax_key = _find_row_any(income, ("tax provision",), ("income tax",))
            pretax_key = _find_row_any(income, ("pretax income",), ("pre-tax income",))
            if tax_key and pretax_key:
                try:
                    tax = _safe_float(income.loc[tax_key, income.columns[0]])
                    pretax = _safe_float(income.loc[pretax_key, income.columns[0]])
                    if tax is not None and pretax and abs(pretax) > 1e-6:
                        tax_rate = max(0.0, min(0.40, tax / pretax))
                except Exception:
                    pass

        v = market_cap + total_debt
        if v > 0:
            wacc = ke * (market_cap / v) + kd * (1.0 - tax_rate) * (total_debt / v)
        else:
            wacc = ke

        # ROIC from latest year
        roic: Optional[float] = None
        if income is not None and balance is not None and not income.empty and not balance.empty:
            ebit_key = _find_row_any(income, ("ebit",), ("operating income",))
            asset_key = _find_row(balance, "total assets")
            curr_liab_key = _find_row_any(balance, ("total current liabilities",), ("current liabilities",))
            cash_key = _find_row_any(balance, ("cash and cash equivalents",), ("cash and short term",))
            if ebit_key and asset_key:
                try:
                    ebit = _safe_float(income.loc[ebit_key, income.columns[0]])
                    assets = _safe_float(balance.loc[asset_key, balance.columns[0]])
                    curr_liab = _safe_float(balance.loc[curr_liab_key, balance.columns[0]]) if curr_liab_key else 0.0
                    cash = _safe_float(balance.loc[cash_key, balance.columns[0]]) if cash_key else 0.0
                    if ebit and assets:
                        ic = assets - (curr_liab or 0.0) - (cash or 0.0)
                        if ic > 0:
                            roic = ebit * (1.0 - tax_rate) / ic
                except Exception:
                    pass

        spread = (roic - wacc) if roic is not None else None

        return {
            "roic": round(roic, 4) if roic is not None else None,
            "wacc": round(wacc, 4),
            "ke": round(ke, 4),
            "kd": round(kd, 4),
            "spread": round(spread, 4) if spread is not None else None,
            "creating_value": bool(spread > 0) if spread is not None else None,
            "beta": round(beta, 2),
            "tax_rate": round(tax_rate, 3),
        }

    # ------------------------------------------------------------------
    # Panel 2b — Historical P/E percentile
    # ------------------------------------------------------------------

    @classmethod
    def _historical_pe(cls, ticker: yf.Ticker, info: Dict) -> Dict[str, Any]:
        try:
            trailing_eps = _safe_float(info.get("trailingEps"))
            if not trailing_eps or trailing_eps <= 0:
                return {"available": False}

            hist = ticker.history(period="5y", interval="1mo")
            if hist is None or hist.empty:
                return {"available": False}

            pe_series = []
            for _, row in hist.iterrows():
                price = _safe_float(row.get("Close"))
                if price and price > 0:
                    pe = price / trailing_eps
                    if 0 < pe < 300:
                        pe_series.append(pe)

            if len(pe_series) < 12:
                return {"available": False}

            pe_sorted = sorted(pe_series)
            n = len(pe_sorted)
            current_pe = _safe_float(info.get("trailingPE"))

            def pct(p: float) -> float:
                return round(pe_sorted[int(p / 100 * (n - 1))], 1)

            current_percentile = None
            if current_pe and current_pe > 0:
                below = sum(1 for v in pe_series if v < current_pe)
                current_percentile = round(below / n * 100)

            return {
                "available": True,
                "current_pe": round(current_pe, 1) if current_pe else None,
                "p5": pct(5),
                "p25": pct(25),
                "p50": pct(50),
                "p75": pct(75),
                "p95": pct(95),
                "current_percentile": current_percentile,
                "min": round(pe_sorted[0], 1),
                "max": round(pe_sorted[-1], 1),
                "history_months": n,
            }
        except Exception:
            return {"available": False}

    # ------------------------------------------------------------------
    # Panel 3a — Insider activity
    # ------------------------------------------------------------------

    @classmethod
    def _insider_activity(cls, ticker: yf.Ticker) -> Dict[str, Any]:
        try:
            df = ticker.insider_transactions
            if df is None or df.empty:
                return {"available": False, "transactions": []}

            cutoff = datetime.now() - timedelta(days=180)
            results: List[Dict] = []
            buy_count = 0
            sell_count = 0

            for _, row in df.iterrows():
                try:
                    # Date column varies by yfinance version
                    date_raw = (
                        row.get("startDate")
                        or row.get("Start Date")
                        or row.get("Date")
                        or row.get("date")
                    )
                    if hasattr(date_raw, "to_pydatetime"):
                        date_val = date_raw.to_pydatetime().replace(tzinfo=None)
                    elif isinstance(date_raw, datetime):
                        date_val = date_raw.replace(tzinfo=None)
                    else:
                        date_val = None

                    if date_val and date_val < cutoff:
                        continue

                    text = str(row.get("Text") or row.get("text") or "").lower()
                    insider_name = str(row.get("Insider") or row.get("insider") or "Unknown")
                    shares = _safe_float(row.get("Shares") or row.get("shares"))
                    value = _safe_float(row.get("Value") or row.get("value"))

                    is_buy = any(w in text for w in ["purchase", "buy", "acquisition", "bought", "grant"])
                    is_sell = any(w in text for w in ["sale", "sell", "dispose", "sold"])

                    if is_buy:
                        buy_count += 1
                        tx_type = "Buy"
                    elif is_sell:
                        sell_count += 1
                        tx_type = "Sale"
                    else:
                        tx_type = "Other"

                    results.append({
                        "date": date_val.strftime("%Y-%m-%d") if date_val else "—",
                        "insider": insider_name,
                        "type": tx_type,
                        "shares": int(shares) if shares else None,
                        "value": int(value) if value else None,
                        "text": str(row.get("Text") or ""),
                    })
                except Exception:
                    continue

            results = results[:10]

            total = buy_count + sell_count
            if total == 0:
                sentiment = "neutral"
            elif buy_count / total >= 0.6:
                sentiment = "bullish"
            elif sell_count / total >= 0.6:
                sentiment = "bearish"
            else:
                sentiment = "neutral"

            return {
                "available": True,
                "net_sentiment": sentiment,
                "recent_buys": buy_count,
                "recent_sells": sell_count,
                "transactions": results,
            }
        except Exception:
            return {"available": False, "transactions": []}

    # ------------------------------------------------------------------
    # Panel 3b — Analyst upgrades/downgrades
    # ------------------------------------------------------------------

    @classmethod
    def _analyst_activity(cls, ticker: yf.Ticker) -> Dict[str, Any]:
        try:
            df = ticker.upgrades_downgrades
            if df is None or df.empty:
                return {"available": False, "changes": []}

            # Normalize: reset index if date is the index
            if df.index.name in ("GradeDate", "Date", "date"):
                df = df.reset_index()

            cutoff = datetime.now() - timedelta(days=180)
            results: List[Dict] = []
            upgrades = 0
            downgrades = 0

            for _, row in df.iterrows():
                try:
                    date_raw = (
                        row.get("GradeDate")
                        or row.get("Date")
                        or row.get("date")
                    )
                    if hasattr(date_raw, "to_pydatetime"):
                        date_val = date_raw.to_pydatetime().replace(tzinfo=None)
                    elif isinstance(date_raw, datetime):
                        date_val = date_raw.replace(tzinfo=None)
                    else:
                        date_val = None

                    if date_val and date_val < cutoff:
                        continue

                    action_raw = str(row.get("Action") or row.get("action") or "").lower()
                    from_grade = str(row.get("FromGrade") or row.get("from_grade") or "")
                    to_grade = str(row.get("ToGrade") or row.get("to_grade") or "")
                    firm = str(row.get("Firm") or row.get("firm") or "Unknown")

                    if "up" in action_raw:
                        upgrades += 1
                        action_type = "upgrade"
                    elif "down" in action_raw:
                        downgrades += 1
                        action_type = "downgrade"
                    elif any(w in action_raw for w in ["init", "reit", "maint"]):
                        action_type = "reiterate"
                    else:
                        action_type = action_raw or "reiterate"

                    results.append({
                        "date": date_val.strftime("%Y-%m-%d") if date_val else "—",
                        "firm": firm,
                        "from_grade": from_grade,
                        "to_grade": to_grade,
                        "action": action_type,
                    })
                except Exception:
                    continue

            results = results[:10]

            if upgrades > downgrades:
                sentiment = "bullish"
            elif downgrades > upgrades:
                sentiment = "bearish"
            else:
                sentiment = "neutral"

            return {
                "available": True,
                "net_sentiment": sentiment,
                "recent_upgrades": upgrades,
                "recent_downgrades": downgrades,
                "changes": results,
            }
        except Exception:
            return {"available": False, "changes": []}


moat_service = MoatService()
