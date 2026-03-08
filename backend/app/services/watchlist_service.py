from __future__ import annotations

import math
import os
import uuid
from datetime import datetime
from typing import Any

import yfinance as yf

from app.db.session import db
from app.services.technical_service import technical_service
from app.services.industry_valuation import compute_valuation_scores


def _read_env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


class WatchlistService:
    _BASE_METRIC_COUNT = 7
    _RISK_FREE_RATE = _read_env_float("WATCHLIST_DCF_RISK_FREE_RATE", 0.043)
    _EQUITY_RISK_PREMIUM = _read_env_float("WATCHLIST_DCF_EQUITY_RISK_PREMIUM", 0.06)
    _DEFAULT_BETA = 1.0
    _GF_DCF_WEIGHT = _read_env_float("WATCHLIST_GF_DCF_WEIGHT", 0.45)
    _GF_RELATIVE_WEIGHT = _read_env_float("WATCHLIST_GF_RELATIVE_WEIGHT", 0.55)
    _DCF_GROWTH_STAGE_YEARS = int(_read_env_float("WATCHLIST_DCF_GROWTH_STAGE_YEARS", 10))
    _DCF_TERMINAL_STAGE_YEARS = int(_read_env_float("WATCHLIST_DCF_TERMINAL_STAGE_YEARS", 10))
    _DCF_TERMINAL_GROWTH = _read_env_float("WATCHLIST_DCF_TERMINAL_GROWTH", 0.04)
    _DCF_GROWTH_MIN = _read_env_float("WATCHLIST_DCF_GROWTH_MIN", 0.05)
    _DCF_GROWTH_MAX = _read_env_float("WATCHLIST_DCF_GROWTH_MAX", 0.20)
    _CYCLICAL_SECTOR_WEIGHTS = {
        "energy": 18,
        "basic materials": 16,
        "materials": 16,
        "industrials": 8,
    }
    _CYCLICAL_GROUPS = (
        {
            "keywords": ("memory", "dram", "nand", "flash", "storage"),
            "weight": 32,
            "reason": "memory",
        },
        {
            "keywords": ("steel", "aluminum", "copper", "mining", "ore"),
            "weight": 28,
            "reason": "materials",
        },
        {
            "keywords": ("shipping", "freight", "tanker", "container", "airline"),
            "weight": 30,
            "reason": "transport",
        },
        {
            "keywords": ("chemical", "fertilizer", "paper", "pulp", "panel", "display", "solar"),
            "weight": 26,
            "reason": "commodity",
        },
        {
            "keywords": ("oil", "gas", "exploration", "drilling", "refining"),
            "weight": 30,
            "reason": "energy",
        },
    )
    _PRICE_TAKER_KEYWORDS = (
        "memory",
        "dram",
        "nand",
        "flash",
        "storage",
        "steel",
        "aluminum",
        "copper",
        "shipping",
        "freight",
        "tanker",
        "container",
        "chemical",
        "fertilizer",
        "paper",
        "pulp",
        "panel",
        "display",
        "solar",
        "oil",
        "gas",
        "exploration",
        "drilling",
        "refining",
        "commodity",
    )

    @staticmethod
    def _to_float(value: Any) -> float | None:
        if value is None:
            return None
        try:
            result = float(value)
            if math.isnan(result) or math.isinf(result):
                return None
            return result
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _normalize_symbol(symbol: str) -> str:
        return (symbol or "").strip().upper()

    @staticmethod
    def _clamp(value: float, min_value: float, max_value: float) -> float:
        return max(min_value, min(value, max_value))

    @staticmethod
    def _avg(values: list[float]) -> float | None:
        if not values:
            return None
        return sum(values) / len(values)

    @staticmethod
    def _contains_any_keyword(text: str, keywords: tuple[str, ...]) -> bool:
        return any(keyword in text for keyword in keywords)

    @classmethod
    def search_symbols(cls, q: str, limit: int = 12) -> list[dict[str, Any]]:
        query = (q or "").strip()
        if not query:
            return []

        safe_limit = max(1, min(limit, 50))
        query_upper = query.upper()
        query_lower = query.lower()
        seen: set[str] = set()
        items: list[dict[str, Any]] = []

        conn = db.get_connection()
        try:
            rows = conn.execute(
                """
                SELECT symbol, name, sector, industry, price, market_cap
                FROM screener_data
                WHERE upper(symbol) LIKE ?
                   OR lower(coalesce(name, '')) LIKE ?
                ORDER BY
                    CASE
                        WHEN upper(symbol) = ? THEN 0
                        WHEN upper(symbol) LIKE ? THEN 1
                        ELSE 2
                    END,
                    market_cap DESC NULLS LAST
                LIMIT ?
                """,
                [
                    f"{query_upper}%",
                    f"%{query_lower}%",
                    query_upper,
                    f"{query_upper}%",
                    safe_limit,
                ],
            ).fetchall()

            for row in rows:
                symbol = str(row[0] or "").upper()
                if not symbol or symbol in seen:
                    continue
                seen.add(symbol)
                items.append(
                    {
                        "symbol": symbol,
                        "name": row[1],
                        "sector": row[2],
                        "industry": row[3],
                        "price": cls._to_float(row[4]),
                        "market_cap": cls._to_float(row[5]),
                    }
                )
        finally:
            conn.close()

        if len(items) >= safe_limit:
            return items[:safe_limit]

        # Fallback to yfinance live search for symbols not yet synced in screener cache.
        try:
            live = yf.Search(query_upper, max_results=safe_limit).quotes or []
            for quote in live:
                symbol = cls._normalize_symbol(quote.get("symbol"))
                if not symbol or symbol in seen:
                    continue
                quote_type = str(quote.get("quoteType") or "").upper()
                if quote_type and quote_type not in {"EQUITY", "ETF", "MUTUALFUND"}:
                    continue
                seen.add(symbol)
                items.append(
                    {
                        "symbol": symbol,
                        "name": quote.get("shortname") or quote.get("longname"),
                        "sector": None,
                        "industry": None,
                        "price": cls._to_float(quote.get("regularMarketPrice")),
                        "market_cap": cls._to_float(quote.get("marketCap")),
                    }
                )
                if len(items) >= safe_limit:
                    break
        except Exception:
            pass

        return items[:safe_limit]

    @classmethod
    def _get_item_rows(cls) -> list[tuple]:
        conn = db.get_connection()
        try:
            return conn.execute(
                """
                SELECT id, symbol, note, created_at, updated_at
                FROM watchlist_items
                ORDER BY updated_at DESC
                """
            ).fetchall()
        finally:
            conn.close()

    @classmethod
    def _get_screener_snapshot(cls, symbols: list[str]) -> dict[str, dict[str, Any]]:
        if not symbols:
            return {}
        conn = db.get_connection()
        try:
            placeholders = ", ".join(["?"] * len(symbols))
            rows = conn.execute(
                f"""
                SELECT
                    symbol, name, sector, industry, price, market_cap,
                    forward_pe, trailing_pe, peg_ratio, price_to_fcf,
                    revenue_growth, eps_growth, free_cash_flow, roic, roe,
                    profit_margin, operating_margin, gross_margin, debt_to_equity, current_ratio,
                    fifty_day_sma, two_hundred_day_sma,
                    beta, total_debt, total_cash,
                    updated_at
                FROM screener_data
                WHERE symbol IN ({placeholders})
                """,
                symbols,
            ).fetchall()

            mapped: dict[str, dict[str, Any]] = {}
            for row in rows:
                mapped[str(row[0]).upper()] = {
                    "symbol": str(row[0]).upper(),
                    "name": row[1],
                    "sector": row[2],
                    "industry": row[3],
                    "price": cls._to_float(row[4]),
                    "market_cap": cls._to_float(row[5]),
                    "forward_pe": cls._to_float(row[6]),
                    "trailing_pe": cls._to_float(row[7]),
                    "peg_ratio": cls._to_float(row[8]),
                    "price_to_fcf": cls._to_float(row[9]),
                    "revenue_growth": cls._to_float(row[10]),
                    "eps_growth": cls._to_float(row[11]),
                    "free_cash_flow": cls._to_float(row[12]),
                    "roic": cls._to_float(row[13]),
                    "roe": cls._to_float(row[14]),
                    "profit_margin": cls._to_float(row[15]),
                    "operating_margin": cls._to_float(row[16]),
                    "gross_margin": cls._to_float(row[17]),
                    "debt_to_equity": cls._to_float(row[18]),
                    "current_ratio": cls._to_float(row[19]),
                    "fifty_day_sma": cls._to_float(row[20]),
                    "two_hundred_day_sma": cls._to_float(row[21]),
                    "beta": cls._to_float(row[22]),
                    "total_debt": cls._to_float(row[23]),
                    "total_cash": cls._to_float(row[24]),
                    "updated_at": row[25],
                }
            return mapped
        finally:
            conn.close()

    @classmethod
    def _get_technical_snapshot(cls, symbols: list[str]) -> dict[str, dict[str, Any]]:
        if not symbols:
            return {}

        try:
            raw = technical_service.get_technicals(symbols)
        except Exception:
            return {}

        mapped: dict[str, dict[str, Any]] = {}
        for item in raw:
            symbol = cls._normalize_symbol(item.get("symbol"))
            if not symbol:
                continue
            mapped[symbol] = {
                "rsi14": cls._to_float(item.get("rsi14")),
                "fifty_two_week_position": cls._to_float(item.get("fiftyTwoWeekPosition")),
                "warnings": item.get("warnings") or [],
            }
        return mapped

    @classmethod
    def _compute_dcf_fair_value(
        cls,
        base_val_per_share: float,
        growth_rate: float,
        discount_rate: float,
        terminal_growth: float,
        years: int = 10,
    ) -> float | None:
        if (
            base_val_per_share <= 0
            or discount_rate <= terminal_growth
            or discount_rate <= 0
            or years < 3
        ):
            return None

        # Stage 1: Growth Stage
        x = (1 + growth_rate) / (1 + discount_rate)
        if abs(x - 1.0) < 1e-6:
            growth_value = base_val_per_share * years * x
        else:
            growth_value = base_val_per_share * x * (1 - x**years) / (1 - x)

        # Stage 2: Terminal Stage
        e_n = base_val_per_share * (1 + growth_rate)**years
        y = (1 + terminal_growth) / (1 + discount_rate)
        if abs(y - 1.0) < 1e-6:
            terminal_value = e_n * 10 * y # Assuming 10 years terminal stage
        else:
            terminal_value = e_n * y * (1 - y**10) / (1 - y)
            
        return growth_value + terminal_value

    @classmethod
    def _solve_implied_growth(
        cls,
        target_price: float,
        base_val_per_share: float,
        discount_rate: float,
        terminal_growth: float,
        years: int,
    ) -> float | None:
        if target_price <= 0 or base_val_per_share <= 0:
            return None

        def f_growth(g_test):
            fv = cls._compute_dcf_fair_value(
                base_val_per_share=base_val_per_share,
                growth_rate=g_test,
                discount_rate=discount_rate,
                terminal_growth=terminal_growth,
                years=years,
            )
            return fv if fv is not None else -1

        # Binary search for implied growth
        low, high = -0.5, 2.0
        if f_growth(low) <= target_price <= f_growth(high):
            for _ in range(48):
                mid = (low + high) / 2
                fv_mid = f_growth(mid)
                if fv_mid < target_price:
                    low = mid
                else:
                    high = mid
            return (low + high) / 2
            
        return None

    @classmethod
    def _compute_dcf_valuation(cls, snapshot: dict[str, Any]) -> dict[str, Any]:
        def rank_high_better(value: float | None, bands: list[float]) -> float | None:
            if value is None:
                return None
            if value >= bands[0]:
                return 10.0
            if value >= bands[1]:
                return 8.0
            if value >= bands[2]:
                return 6.0
            if value >= bands[3]:
                return 4.0
            return 2.0

        def rank_low_better(value: float | None, bands: list[float]) -> float | None:
            if value is None:
                return None
            if value <= bands[0]:
                return 10.0
            if value <= bands[1]:
                return 8.0
            if value <= bands[2]:
                return 6.0
            if value <= bands[3]:
                return 4.0
            return 2.0

        def finalize_rank(values: list[float | None], default: int = 5) -> int:
            cleaned = [float(v) for v in values if v is not None]
            if not cleaned:
                return default
            return int(round(cls._clamp(sum(cleaned) / len(cleaned), 1, 10)))

        price = cls._to_float(snapshot.get("price"))
        market_cap = cls._to_float(snapshot.get("market_cap"))
        free_cash_flow = cls._to_float(snapshot.get("free_cash_flow"))
        revenue_growth = cls._to_float(snapshot.get("revenue_growth"))
        eps_growth = cls._to_float(snapshot.get("eps_growth"))
        forward_pe = cls._to_float(snapshot.get("forward_pe"))
        trailing_pe = cls._to_float(snapshot.get("trailing_pe"))
        peg_ratio = cls._to_float(snapshot.get("peg_ratio"))
        price_to_fcf = cls._to_float(snapshot.get("price_to_fcf"))
        roic = cls._to_float(snapshot.get("roic"))
        roe = cls._to_float(snapshot.get("roe"))
        profit_margin = cls._to_float(snapshot.get("profit_margin"))
        operating_margin = cls._to_float(snapshot.get("operating_margin"))
        gross_margin = cls._to_float(snapshot.get("gross_margin"))
        debt_to_equity = cls._to_float(snapshot.get("debt_to_equity"))
        current_ratio = cls._to_float(snapshot.get("current_ratio"))
        beta = cls._to_float(snapshot.get("beta"))
        total_debt_raw = cls._to_float(snapshot.get("total_debt"))
        total_cash_raw = cls._to_float(snapshot.get("total_cash"))
        total_debt = total_debt_raw or 0.0
        total_cash = total_cash_raw or 0.0
        net_debt = total_debt - total_cash

        unavailable_base = {
            "model": "DCF",
            "status": "UNAVAILABLE",
            "valuation_method": None,
            "valuation_label": None,
            "fair_value": None,
            "dcf_fair_value": None,
            "dcf_upside_pct": None,
            "fair_value_low": None,
            "fair_value_high": None,
            "upside_pct": None,
            "implied_growth_10y": None,
            "discount_rate": None,
            "terminal_growth": None,
            "fcf_growth_5y": None,
            "base_fcf": cls._round(base_val_per_share) if 'base_val_per_share' in locals() else cls._round(free_cash_flow),
            "shares_outstanding": None,
            "net_debt": cls._round(net_debt),
            "risk_free_rate": cls._round(cls._RISK_FREE_RATE),
            "equity_risk_premium": cls._round(cls._EQUITY_RISK_PREMIUM),
            "profitability_rank": None,
            "growth_rank": None,
            "financial_strength_rank": None,
            "valuation_rank": None,
            "gf_score": None,
            "scenarios": [],
            "confidence": 30,
        }

        if (
            price is None
            or price <= 0
            or market_cap is None
            or market_cap <= 0
            or free_cash_flow is None
            or free_cash_flow <= 0
        ):
            return {
                **unavailable_base,
                "summary": {"key": "watchlist.valuation.summary.unavailable_data", "params": {}},
            }

        shares_outstanding = market_cap / price if price > 0 else None
        if shares_outstanding is None or shares_outstanding <= 0:
            return {
                **unavailable_base,
                "summary": {"key": "watchlist.valuation.summary.unavailable_shares", "params": {}},
            }
            
        fcf_per_share = free_cash_flow / shares_outstanding if free_cash_flow else None
        eps = price / trailing_pe if trailing_pe and trailing_pe > 0 else None
        base_val_per_share = eps if eps and eps > 0 else fcf_per_share
        
        if base_val_per_share is None or base_val_per_share <= 0:
            return {
                **unavailable_base,
                "summary": {"key": "watchlist.valuation.summary.unavailable_metrics", "params": {}},
            }

        growth_inputs = [value for value in [revenue_growth, eps_growth] if value is not None]
        if growth_inputs:
            raw_growth = sum(growth_inputs) / len(growth_inputs)
        else:
            raw_growth = 0.08

        # Bound the growth assumption and extend explicit forecast years for growth names.
        fcf_growth_5y = cls._clamp(raw_growth, -0.05, 0.30)
        if fcf_growth_5y >= 0.2:
            forecast_years = 10
        elif fcf_growth_5y >= 0.12:
            forecast_years = 8
        else:
            forecast_years = 6

        beta_used = beta if beta is not None and beta > 0 else cls._DEFAULT_BETA
        risk_free_rate = cls._RISK_FREE_RATE
        equity_risk_premium = cls._EQUITY_RISK_PREMIUM
        discount_rate = risk_free_rate + beta_used * equity_risk_premium
        discount_rate = cls._clamp(discount_rate, 0.065, 0.155)

        if fcf_growth_5y <= 0:
            terminal_growth = 0.015
        else:
            terminal_growth = cls._clamp(0.02 + min(0.01, fcf_growth_5y * 0.1), 0.015, 0.03)
        if discount_rate <= terminal_growth + 0.01:
            discount_rate = terminal_growth + 0.01

        fair_value = cls._compute_dcf_fair_value(
            base_val_per_share=base_val_per_share,
            growth_rate=fcf_growth_5y,
            discount_rate=discount_rate,
            terminal_growth=terminal_growth,
            years=forecast_years,
        )
        if fair_value is None:
            return {
                **unavailable_base,
                "shares_outstanding": cls._round(shares_outstanding),
                "summary": {"key": "watchlist.valuation.summary.invalid_math", "params": {}},
            }

        dcf_fair_value = max(fair_value, 0.0)
        dcf_upside_pct = (dcf_fair_value - price) / price

        scenario_inputs = [
            (
                "BEAR",
                cls._clamp(fcf_growth_5y - 0.05, -0.10, 0.25),
                cls._clamp(discount_rate + 0.015, terminal_growth + 0.01, 0.19),
            ),
            ("BASE", fcf_growth_5y, discount_rate),
            (
                "BULL",
                cls._clamp(fcf_growth_5y + 0.05, -0.02, 0.35),
                cls._clamp(discount_rate - 0.015, terminal_growth + 0.01, 0.16),
            ),
        ]
        scenarios: list[dict[str, float | str]] = []
        fair_values: list[float] = []
        for label, scenario_growth, scenario_discount in scenario_inputs:
            scenario_fair_value = cls._compute_dcf_fair_value(
                base_val_per_share=base_val_per_share,
                growth_rate=scenario_growth,
                discount_rate=scenario_discount,
                terminal_growth=terminal_growth,
                years=forecast_years,
            )
            if scenario_fair_value is None:
                continue
            scenario_fair_value = max(scenario_fair_value, 0.0)
            fair_values.append(scenario_fair_value)
            scenarios.append(
                {
                    "label": label,
                    "fcf_growth_5y": cls._round(scenario_growth),
                    "discount_rate": cls._round(scenario_discount),
                    "fair_value": cls._round(scenario_fair_value),
                }
            )

        dcf_fair_value_low = min(fair_values) if fair_values else dcf_fair_value * 0.85
        dcf_fair_value_high = max(fair_values) if fair_values else dcf_fair_value * 1.15
        dcf_fair_value_low = max(dcf_fair_value_low, 0.0)
        dcf_fair_value_high = max(dcf_fair_value_high, dcf_fair_value_low)

        growth_anchor = cls._clamp((eps_growth if eps_growth is not None else (revenue_growth or 0.1)) * 100, 0, 40)
        relative_candidates: list[float] = []

        if forward_pe is not None and forward_pe > 0:
            fair_forward_pe = cls._clamp(12 + growth_anchor * 0.42, 12, 32)
            relative_candidates.append(price * (fair_forward_pe / forward_pe))
        elif trailing_pe is not None and trailing_pe > 0:
            fair_trailing_pe = cls._clamp(12 + growth_anchor * 0.35, 12, 34)
            relative_candidates.append(price * (fair_trailing_pe / trailing_pe))

        if price_to_fcf is not None and price_to_fcf > 0:
            fair_pfcf = cls._clamp(14 + growth_anchor * 0.45, 14, 36)
            relative_candidates.append(price * (fair_pfcf / price_to_fcf))

        relative_fair_value = cls._avg(relative_candidates)
        dcf_weight = max(0.0, cls._GF_DCF_WEIGHT)
        rel_weight = max(0.0, cls._GF_RELATIVE_WEIGHT)
        total_weight = dcf_weight + rel_weight
        if total_weight <= 0:
            dcf_weight = 0.45
            rel_weight = 0.55
            total_weight = 1.0
        dcf_weight /= total_weight
        rel_weight /= total_weight

        if relative_fair_value is not None:
            fair_value = dcf_fair_value * dcf_weight + relative_fair_value * rel_weight
            relative_low = max(0.0, relative_fair_value * 0.82)
            relative_high = max(relative_low, relative_fair_value * 1.18)
            fair_value_low = max(0.0, min(dcf_fair_value_low, relative_low))
            fair_value_high = max(fair_value_low, max(dcf_fair_value_high, relative_high))
        else:
            fair_value = dcf_fair_value
            fair_value_low = dcf_fair_value_low
            fair_value_high = dcf_fair_value_high

        upside_pct = (fair_value - price) / price

        implied_growth_10y = cls._solve_implied_growth(
            target_price=price,
            base_val_per_share=base_val_per_share,
            discount_rate=discount_rate,
            terminal_growth=terminal_growth,
            years=max(10, forecast_years),
        )

        profitability_rank = finalize_rank(
            [
                rank_high_better(roic, [0.25, 0.15, 0.10, 0.05]),
                rank_high_better(roe, [0.30, 0.20, 0.12, 0.07]),
                rank_high_better(profit_margin, [0.30, 0.20, 0.12, 0.06]),
                rank_high_better(operating_margin, [0.35, 0.22, 0.14, 0.08]),
                rank_high_better(gross_margin, [0.60, 0.45, 0.30, 0.20]),
            ],
            default=5,
        )
        growth_rank = finalize_rank(
            [
                rank_high_better(revenue_growth, [0.30, 0.18, 0.10, 0.03]),
                rank_high_better(eps_growth, [0.40, 0.20, 0.10, 0.03]),
                rank_high_better(fcf_growth_5y, [0.25, 0.15, 0.08, 0.03]),
            ],
            default=5,
        )

        net_debt_to_mcap = None
        if market_cap and market_cap > 0:
            net_debt_to_mcap = net_debt / market_cap
        financial_strength_rank = finalize_rank(
            [
                rank_low_better(debt_to_equity, [20, 50, 100, 180]),
                rank_high_better(current_ratio, [2.0, 1.3, 1.0, 0.8]),
                rank_low_better(net_debt_to_mcap, [-0.10, 0.10, 0.30, 0.60]),
            ],
            default=5,
        )
        valuation_rank = finalize_rank(
            [
                rank_high_better(upside_pct, [0.35, 0.20, 0.05, -0.15]),
                rank_low_better(forward_pe, [12, 20, 30, 45]),
                rank_low_better(peg_ratio, [1.0, 1.5, 2.2, 3.0]),
            ],
            default=5,
        )

        gf_score = int(
            round(
                cls._clamp(
                    (
                        profitability_rank * 0.30
                        + growth_rank * 0.25
                        + financial_strength_rank * 0.25
                        + valuation_rank * 0.20
                    )
                    * 10,
                    0,
                    100,
                )
            )
        )

        confidence = 50
        if len(growth_inputs) == 2:
            confidence += 15
        elif len(growth_inputs) == 1:
            confidence += 8
        if beta is not None and beta > 0:
            confidence += 5
        if total_debt_raw is not None and total_cash_raw is not None:
            confidence += 10
        elif total_debt_raw is not None or total_cash_raw is not None:
            confidence += 4
        if len(scenarios) == 3:
            confidence += 10
        if relative_fair_value is not None:
            confidence += 5
        confidence = max(30, min(95, confidence))

        if upside_pct >= 0.30:
            valuation_label = "DISCOUNT"
            valuation_call = "discount to intrinsic value"
        elif upside_pct <= -0.55:
            valuation_label = "EXTREME_PREMIUM"
            valuation_call = "extreme premium"
        elif upside_pct <= -0.25:
            valuation_label = "PREMIUM"
            valuation_call = "premium"
        else:
            valuation_label = "FAIR"
            valuation_call = "fair range"

        return {
            "model": "DCF",
            "status": "AVAILABLE",
            "valuation_method": "GF_BLEND_DCF_MULTIPLE",
            "valuation_label": valuation_label,
            "fair_value": cls._round(fair_value),
            "dcf_fair_value": cls._round(dcf_fair_value),
            "dcf_upside_pct": cls._round(dcf_upside_pct),
            "fair_value_low": cls._round(fair_value_low),
            "fair_value_high": cls._round(fair_value_high),
            "upside_pct": cls._round(upside_pct),
            "implied_growth_10y": cls._round(implied_growth_10y),
            "discount_rate": cls._round(discount_rate),
            "terminal_growth": cls._round(terminal_growth),
            "fcf_growth_5y": cls._round(fcf_growth_5y),
            "base_fcf": cls._round(base_val_per_share),
            "shares_outstanding": cls._round(shares_outstanding),
            "net_debt": cls._round(net_debt),
            "risk_free_rate": cls._round(risk_free_rate),
            "equity_risk_premium": cls._round(equity_risk_premium),
            "profitability_rank": profitability_rank,
            "growth_rank": growth_rank,
            "financial_strength_rank": financial_strength_rank,
            "valuation_rank": valuation_rank,
            "gf_score": gf_score,
            "scenarios": scenarios,
            "confidence": confidence,
            "summary": {
                "key": f"watchlist.valuation.summary.{valuation_label.lower()}",
                "params": {
                    "g": round(fcf_growth_5y * 100, 1),
                    "r": round(discount_rate * 100, 1),
                    "tg": round(terminal_growth * 100, 1),
                    "years": forecast_years,
                    "w_dcf": round(dcf_weight, 2),
                    "w_rel": round(rel_weight, 2),
                    "implied_g": round(implied_growth_10y * 100, 1) if implied_growth_10y is not None else None
                }
            },
        }

    @classmethod
    def _compute_signal(
        cls,
        snapshot: dict[str, Any],
        technicals: dict[str, Any],
        valuation: dict[str, Any],
    ) -> dict[str, Any]:
        score = 0.0
        positives: list[dict[str, Any]] = []
        negatives: list[dict[str, Any]] = []
        metric_count = 0

        def add_msg(lst, key, **params):
            lst.append({"key": f"watchlist.signals.reasons.{key}", "params": params})

        forward_pe = cls._to_float(snapshot.get("forward_pe"))
        if forward_pe is not None and forward_pe > 0:
            metric_count += 1
            if forward_pe <= 22:
                score += 1
                add_msg(positives, "pe_attractive", value=round(forward_pe, 1))
            elif forward_pe >= 45:
                score -= 1
                add_msg(negatives, "pe_stretched", value=round(forward_pe, 1))

        revenue_growth = cls._to_float(snapshot.get("revenue_growth"))
        if revenue_growth is not None:
            metric_count += 1
            if revenue_growth >= 0.15:
                score += 1
                add_msg(positives, "revenue_growth_good", value=round(revenue_growth * 100, 1))
            elif revenue_growth <= 0:
                score -= 1
                add_msg(negatives, "revenue_growth_negative")

        eps_growth = cls._to_float(snapshot.get("eps_growth"))
        if eps_growth is not None:
            metric_count += 1
            if eps_growth >= 0.15:
                score += 1
                add_msg(positives, "eps_growth_good", value=round(eps_growth * 100, 1))
            elif eps_growth <= 0:
                score -= 1
                add_msg(negatives, "eps_growth_negative")

        roic = cls._to_float(snapshot.get("roic"))
        if roic is not None:
            metric_count += 1
            if roic >= 0.12:
                score += 1
                add_msg(positives, "roic_strong", value=round(roic * 100, 1))
            elif roic <= 0.05:
                score -= 1
                add_msg(negatives, "roic_weak")

        price_to_fcf = cls._to_float(snapshot.get("price_to_fcf"))
        if price_to_fcf is not None and price_to_fcf > 0:
            metric_count += 1
            if price_to_fcf <= 25:
                score += 1
                add_msg(positives, "pfcf_attractive", value=round(price_to_fcf, 1))
            elif price_to_fcf >= 50:
                score -= 1
                add_msg(negatives, "pfcf_expensive", value=round(price_to_fcf, 1))

        rsi14 = cls._to_float(technicals.get("rsi14"))
        if rsi14 is not None:
            metric_count += 1
            if rsi14 <= 35:
                score += 0.5
                add_msg(positives, "rsi_oversold", value=round(rsi14, 1))
            elif rsi14 >= 72:
                score -= 1
                add_msg(negatives, "rsi_overbought", value=round(rsi14, 1))

        pos_52w = cls._to_float(technicals.get("fifty_two_week_position"))
        if pos_52w is not None:
            metric_count += 1
            if pos_52w <= 0.2:
                score += 0.5
                add_msg(positives, "low_52w_range")
            elif pos_52w >= 0.9:
                score -= 0.5
                add_msg(negatives, "high_52w_range")

        if str(valuation.get("status")) == "AVAILABLE":
            upside_pct = cls._to_float(valuation.get("upside_pct"))
            if upside_pct is not None:
                metric_count += 1
                if upside_pct >= 0.30:
                    score += 1.0
                    add_msg(positives, "valuation_upside", value=round(upside_pct * 100, 1))
                elif upside_pct <= -0.25:
                    score -= 1.0
                    add_msg(negatives, "valuation_premium", value=round(abs(upside_pct) * 100, 1))
                    if upside_pct <= -0.55:
                        score -= 0.4
                        add_msg(negatives, "extreme_premium")

        if score >= 2.5:
            action = "BUY"
            ordered_reasons = positives + negatives
        elif score <= -2:
            action = "SELL"
            ordered_reasons = negatives + positives
        else:
            action = "HOLD"
            ordered_reasons = positives[:2] + negatives[:2]

        reasons = ordered_reasons[:4] or [{"key": "watchlist.signals.reasons.mixed_data", "params": {}}]
        data_coverage = round(metric_count / (cls._BASE_METRIC_COUNT + 1), 2)
        confidence = int(45 + min(35, abs(score) * 12) + data_coverage * 18)
        confidence = max(25, min(95, confidence))

        updated_at = snapshot.get("updated_at")
        freshness_days = None
        if updated_at:
            try:
                freshness_days = max(
                    0,
                    (datetime.now().date() - updated_at.date()).days,
                )
            except Exception:
                freshness_days = None

        return {
            "action": action,
            "score": round(score, 2),
            "confidence": confidence,
            "data_coverage": data_coverage,
            "freshness_days": freshness_days,
            "reasons": reasons,
        }

    @staticmethod
    def _score_to_percent(value: int | None, default: int = 5) -> int:
        rank = value if value is not None else default
        return int(round(max(0, min(10, rank)) * 10))

    @classmethod
    def _compute_quality_profile(cls, valuation: dict[str, Any]) -> dict[str, Any]:
        profitability_rank = valuation.get("profitability_rank")
        growth_rank = valuation.get("growth_rank")
        financial_strength_rank = valuation.get("financial_strength_rank")
        valuation_rank = valuation.get("valuation_rank")

        score = int(
            round(
                cls._clamp(
                    (
                        (profitability_rank or 5) * 0.35
                        + (growth_rank or 5) * 0.25
                        + (financial_strength_rank or 5) * 0.25
                        + (valuation_rank or 5) * 0.15
                    )
                    * 10,
                    0,
                    100,
                )
            )
        )

        if score >= 80:
            outlook = "ELITE"
        elif score >= 68:
            outlook = "STRONG"
        elif score >= 55:
            outlook = "AVERAGE"
        else:
            outlook = "SPECULATIVE"

        return {
            "score": score,
            "outlook": outlook,
            "profitability": profitability_rank,
            "growth": growth_rank,
            "financial_strength": financial_strength_rank,
            "valuation_support": valuation_rank,
            "summary": {
                "key": f"watchlist.quality.summary.{outlook.lower()}",
                "params": {
                    "score": score,
                    "profitability": cls._score_to_percent(profitability_rank),
                    "growth": cls._score_to_percent(growth_rank),
                    "financial_strength": cls._score_to_percent(financial_strength_rank),
                    "valuation_support": cls._score_to_percent(valuation_rank),
                },
            },
        }

    @classmethod
    def _compute_value_trap_risk(
        cls,
        snapshot: dict[str, Any],
        technicals: dict[str, Any],
        valuation: dict[str, Any],
        quality: dict[str, Any],
    ) -> dict[str, Any]:
        revenue_growth = cls._to_float(snapshot.get("revenue_growth"))
        eps_growth = cls._to_float(snapshot.get("eps_growth"))
        roic = cls._to_float(snapshot.get("roic"))
        profit_margin = cls._to_float(snapshot.get("profit_margin"))
        debt_to_equity = cls._to_float(snapshot.get("debt_to_equity"))
        current_ratio = cls._to_float(snapshot.get("current_ratio"))
        free_cash_flow = cls._to_float(snapshot.get("free_cash_flow"))
        upside_pct = cls._to_float(valuation.get("upside_pct"))
        pos_52w = cls._to_float(technicals.get("fifty_two_week_position"))
        quality_score = int(quality.get("score") or 50)

        risk_score = 0
        reasons: list[dict[str, Any]] = []

        def add(points: int, key: str, **params: Any) -> None:
            nonlocal risk_score
            risk_score += points
            reasons.append(
                {
                    "key": f"watchlist.valueTrap.reasons.{key}",
                    "params": params,
                }
            )

        if revenue_growth is not None:
            if revenue_growth <= 0:
                add(18, "revenue_negative")
            elif revenue_growth < 0.05:
                add(10, "revenue_stalling", value=round(revenue_growth * 100, 1))

        if eps_growth is not None:
            if eps_growth <= 0:
                add(18, "eps_negative")
            elif eps_growth < 0.05:
                add(10, "eps_stalling", value=round(eps_growth * 100, 1))

        if roic is not None and roic < 0.08:
            add(14, "low_roic", value=round(roic * 100, 1))

        if debt_to_equity is not None and debt_to_equity >= 120:
            add(16, "balance_sheet_stress", value=round(debt_to_equity, 1))

        if current_ratio is not None and current_ratio < 1.0:
            add(8, "weak_liquidity", value=round(current_ratio, 2))

        if profit_margin is not None and profit_margin < 0.10:
            add(10, "thin_margin", value=round(profit_margin * 100, 1))

        if free_cash_flow is not None and free_cash_flow <= 0:
            add(18, "negative_fcf")
        elif free_cash_flow is None and str(valuation.get("status")) != "AVAILABLE":
            add(6, "missing_cashflow")

        if upside_pct is not None and upside_pct >= 0.25 and quality_score < 60:
            add(
                12,
                "cheap_but_low_quality",
                upside=round(upside_pct * 100, 1),
                quality=quality_score,
            )

        growth_soft = (
            (revenue_growth is not None and revenue_growth <= 0)
            or (eps_growth is not None and eps_growth <= 0)
        )
        if pos_52w is not None and pos_52w <= 0.15 and growth_soft:
            add(10, "falling_knife")

        if (
            debt_to_equity is not None
            and debt_to_equity >= 80
            and (
                (revenue_growth is not None and revenue_growth < 0.05)
                or (eps_growth is not None and eps_growth < 0.05)
            )
        ):
            add(10, "leverage_without_growth")

        risk_score = int(round(cls._clamp(risk_score, 0, 100)))

        if risk_score >= 60:
            level = "HIGH"
        elif risk_score >= 35:
            level = "MEDIUM"
        else:
            level = "LOW"

        if not reasons:
            reasons.append(
                {
                    "key": "watchlist.valueTrap.reasons.resilient",
                    "params": {"quality": quality_score},
                }
            )

        return {
            "level": level,
            "score": risk_score,
            "reasons": reasons[:4],
        }

    @classmethod
    def _compute_cycle_profile(
        cls,
        snapshot: dict[str, Any],
        technicals: dict[str, Any],
        valuation: dict[str, Any],
        quality: dict[str, Any],
    ) -> dict[str, Any]:
        sector = str(snapshot.get("sector") or "").strip().lower()
        industry = str(snapshot.get("industry") or "").strip().lower()
        combined = f"{sector} {industry}".strip()

        forward_pe = cls._to_float(snapshot.get("forward_pe"))
        trailing_pe = cls._to_float(snapshot.get("trailing_pe"))
        revenue_growth = cls._to_float(snapshot.get("revenue_growth"))
        eps_growth = cls._to_float(snapshot.get("eps_growth"))
        gross_margin = cls._to_float(snapshot.get("gross_margin"))
        operating_margin = cls._to_float(snapshot.get("operating_margin"))
        free_cash_flow = cls._to_float(snapshot.get("free_cash_flow"))
        beta = cls._to_float(snapshot.get("beta"))
        pos_52w = cls._to_float(technicals.get("fifty_two_week_position"))
        quality_score = int(quality.get("score") or 50)

        exposure_score = cls._CYCLICAL_SECTOR_WEIGHTS.get(sector, 0)

        matched_group: dict[str, Any] | None = None
        for group in cls._CYCLICAL_GROUPS:
            if cls._contains_any_keyword(combined, group["keywords"]):
                matched_group = group
                exposure_score += int(group["weight"])
                break

        price_taker = cls._contains_any_keyword(combined, cls._PRICE_TAKER_KEYWORDS)
        if price_taker:
            exposure_score += 12

        reference_pe = cls._avg(
            [pe for pe in [forward_pe, trailing_pe] if pe is not None and pe > 0]
        )
        if reference_pe is not None and reference_pe <= 12:
            exposure_score += 6

        if gross_margin is not None and gross_margin <= 0.35:
            exposure_score += 6
        if operating_margin is not None and operating_margin <= 0.15:
            exposure_score += 4
        if beta is not None and beta >= 1.25:
            exposure_score += 4

        is_cyclical = exposure_score >= 24

        if not is_cyclical:
            return {
                "is_cyclical": False,
                "price_taker": False,
                "earnings_regime": "STEADY",
                "peak_earnings_risk": "LOW",
                "score": 0,
                "normalized_pe": reference_pe,
                "summary": {
                    "key": "watchlist.cycle.summary.steady",
                    "params": {
                        "pe": round(reference_pe, 1) if reference_pe is not None else None,
                    },
                },
                "reasons": [
                    {
                        "key": "watchlist.cycle.reasons.non_cyclical",
                        "params": {"quality": quality_score},
                    }
                ],
            }

        peak_score = 0
        trough_score = 0

        if reference_pe is not None:
            if reference_pe <= 10:
                peak_score += 18
            elif reference_pe <= 14:
                peak_score += 10
            elif reference_pe >= 20:
                trough_score += 10

        if revenue_growth is not None:
            if revenue_growth >= 0.10:
                peak_score += 8
            elif revenue_growth <= 0:
                trough_score += 10

        if eps_growth is not None:
            if eps_growth >= 0.18:
                peak_score += 14
            elif eps_growth <= 0:
                trough_score += 14

        if gross_margin is not None:
            if gross_margin >= 0.40:
                peak_score += 10
            elif gross_margin <= 0.22:
                trough_score += 10

        if operating_margin is not None:
            if operating_margin >= 0.18:
                peak_score += 8
            elif operating_margin <= 0.08:
                trough_score += 8

        if pos_52w is not None:
            if pos_52w >= 0.75:
                peak_score += 8
            elif pos_52w <= 0.25:
                trough_score += 8

        if free_cash_flow is not None and free_cash_flow <= 0:
            trough_score += 6

        if peak_score >= trough_score + 12 and peak_score >= 28:
            earnings_regime = "PEAK"
        elif trough_score >= peak_score + 12 and trough_score >= 24:
            earnings_regime = "TROUGH"
        else:
            earnings_regime = "MID"

        risk_score = 24
        if price_taker:
            risk_score += 18
        if earnings_regime == "PEAK":
            risk_score += 28
        elif earnings_regime == "MID":
            risk_score += 10
        else:
            risk_score -= 18

        if reference_pe is not None:
            if reference_pe <= 10:
                risk_score += 16
            elif reference_pe <= 14:
                risk_score += 8

        if pos_52w is not None and pos_52w >= 0.75:
            risk_score += 8
        if eps_growth is not None and eps_growth >= 0.18:
            risk_score += 8
        if gross_margin is not None and gross_margin >= 0.38:
            risk_score += 6
        if quality_score >= 80 and not price_taker:
            risk_score -= 6

        risk_score = int(round(cls._clamp(risk_score, 0, 100)))

        if risk_score >= 60:
            risk_level = "HIGH"
        elif risk_score >= 35:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        if reference_pe is None:
            normalized_pe = None
        else:
            if earnings_regime == "PEAK":
                adjustment = 1.75 if risk_score >= 70 else 1.55
            elif earnings_regime == "TROUGH":
                adjustment = 0.78
            else:
                adjustment = 1.12 if price_taker else 1.08
            normalized_pe = cls._round(reference_pe * adjustment)

        cycle_reasons: list[dict[str, Any]] = []
        if matched_group is not None:
            cycle_reasons.append(
                {
                    "key": f"watchlist.cycle.reasons.{matched_group['reason']}",
                    "params": {},
                }
            )
        if price_taker:
            cycle_reasons.append(
                {"key": "watchlist.cycle.reasons.price_taker", "params": {}}
            )
        if reference_pe is not None and reference_pe <= 12:
            cycle_reasons.append(
                {
                    "key": "watchlist.cycle.reasons.headline_pe",
                    "params": {"value": round(reference_pe, 1)},
                }
            )
        if earnings_regime == "PEAK":
            cycle_reasons.append(
                {
                    "key": "watchlist.cycle.reasons.peak_signals",
                    "params": {},
                }
            )
        elif earnings_regime == "TROUGH":
            cycle_reasons.append(
                {
                    "key": "watchlist.cycle.reasons.trough_signals",
                    "params": {},
                }
            )
        if pos_52w is not None and pos_52w >= 0.75:
            cycle_reasons.append(
                {
                    "key": "watchlist.cycle.reasons.near_high",
                    "params": {},
                }
            )

        summary_key = (
            "steady"
            if not is_cyclical
            else "peak"
            if earnings_regime == "PEAK"
            else "trough"
            if earnings_regime == "TROUGH"
            else "mid"
        )

        return {
            "is_cyclical": True,
            "price_taker": price_taker,
            "earnings_regime": earnings_regime,
            "peak_earnings_risk": risk_level,
            "score": risk_score,
            "normalized_pe": normalized_pe,
            "summary": {
                "key": f"watchlist.cycle.summary.{summary_key}",
                "params": {
                    "pe": round(reference_pe, 1) if reference_pe is not None else None,
                    "normalized_pe": normalized_pe,
                },
            },
            "reasons": cycle_reasons[:4],
        }

    @classmethod
    def _compute_timing_signal(
        cls,
        snapshot: dict[str, Any],
        technicals: dict[str, Any],
        signal: dict[str, Any],
        valuation: dict[str, Any],
        quality: dict[str, Any],
        value_trap: dict[str, Any],
        cycle_profile: dict[str, Any],
    ) -> dict[str, Any]:
        upside_pct = cls._to_float(valuation.get("upside_pct"))
        rsi14 = cls._to_float(technicals.get("rsi14"))
        pos_52w = cls._to_float(technicals.get("fifty_two_week_position"))
        freshness_days = signal.get("freshness_days")
        confidence = int(signal.get("confidence") or 0)
        quality_score = int(quality.get("score") or 50)
        risk_level = str(value_trap.get("level") or "LOW")
        risk_score = int(value_trap.get("score") or 0)
        cycle_risk_level = str(cycle_profile.get("peak_earnings_risk") or "LOW")
        cycle_risk_score = int(cycle_profile.get("score") or 0)

        timing_score = 50
        positives: list[dict[str, Any]] = []
        negatives: list[dict[str, Any]] = []

        def add_positive(points: int, key: str, **params: Any) -> None:
            nonlocal timing_score
            timing_score += points
            positives.append(
                {
                    "key": f"watchlist.timing.conditions.{key}",
                    "params": params,
                }
            )

        def add_negative(points: int, key: str, **params: Any) -> None:
            nonlocal timing_score
            timing_score -= points
            negatives.append(
                {
                    "key": f"watchlist.timing.conditions.{key}",
                    "params": params,
                }
            )

        if upside_pct is not None:
            if upside_pct >= 0.25:
                add_positive(18, "valuation_window", value=round(upside_pct * 100, 1))
            elif upside_pct >= 0.12:
                add_positive(10, "valuation_support", value=round(upside_pct * 100, 1))
            elif upside_pct < 0:
                add_negative(16, "premium_price", value=round(abs(upside_pct) * 100, 1))
        else:
            add_negative(6, "limited_data")

        if quality_score >= 75:
            add_positive(12, "quality_compounder", value=quality_score)
        elif quality_score < 55:
            add_negative(12, "quality_unproven", value=quality_score)

        if risk_level == "HIGH":
            add_negative(30, "trap_high", value=risk_score)
        elif risk_level == "MEDIUM":
            add_negative(12, "trap_medium", value=risk_score)
        else:
            add_positive(6, "trap_low", value=risk_score)

        if rsi14 is not None:
            if rsi14 <= 45:
                add_positive(8, "pullback_entry", value=round(rsi14, 1))
            elif rsi14 >= 70:
                add_negative(14, "overbought", value=round(rsi14, 1))

        if pos_52w is not None:
            if pos_52w <= 0.35:
                add_positive(4, "off_high")
            elif pos_52w >= 0.85:
                add_negative(8, "near_high")

        if freshness_days is not None:
            if freshness_days <= 3:
                add_positive(6, "fresh_data", value=freshness_days)
            elif freshness_days >= 14:
                add_negative(20, "stale_data", value=freshness_days)

        if confidence >= 75:
            add_positive(5, "confidence_high", value=confidence)
        elif confidence < 60:
            add_negative(8, "confidence_low", value=confidence)

        if cycle_risk_level == "HIGH":
            add_negative(18, "cycle_peak_high", value=cycle_risk_score)
        elif cycle_risk_level == "MEDIUM":
            add_negative(8, "cycle_peak_medium", value=cycle_risk_score)

        timing_score = int(round(cls._clamp(timing_score, 0, 100)))
        signal_action = str(signal.get("action") or "HOLD")

        if signal_action == "SELL" or risk_level == "HIGH":
            status = "AVOID"
            summary_key = "avoid"
        elif freshness_days is not None and freshness_days >= 14:
            status = "STALE"
            summary_key = "stale"
        elif (
            timing_score >= 72
            and upside_pct is not None
            and upside_pct >= 0.18
            and quality_score >= 65
            and (rsi14 is None or rsi14 < 70)
            and (pos_52w is None or pos_52w < 0.88)
        ):
            status = "READY"
            summary_key = "ready"
        elif timing_score >= 60 and quality_score >= 65 and (
            (rsi14 is not None and rsi14 >= 68)
            or (pos_52w is not None and pos_52w >= 0.85)
        ):
            status = "WAIT_PULLBACK"
            summary_key = "wait_pullback"
        else:
            status = "WAIT_CONFIRMATION"
            summary_key = "wait_confirmation"

        if status in {"AVOID", "STALE"}:
            conditions = negatives + positives
        elif status == "WAIT_PULLBACK":
            conditions = positives[:2] + negatives[:2]
        else:
            conditions = positives + negatives

        if not conditions:
            conditions = [{"key": "watchlist.timing.conditions.limited_data", "params": {}}]

        return {
            "status": status,
            "score": timing_score,
            "freshness_days": freshness_days,
            "summary": {
                "key": f"watchlist.timing.summary.{summary_key}",
                "params": {
                    "score": timing_score,
                    "quality": quality_score,
                },
            },
            "conditions": conditions[:4],
        }

    @staticmethod
    def _round(value: float | None) -> float | None:
        if value is None:
            return None
        return round(value, 2)

    @classmethod
    def _compute_trade_plan(
        cls,
        snapshot: dict[str, Any],
        signal: dict[str, Any],
        valuation: dict[str, Any],
    ) -> dict[str, Any]:
        action = str(signal.get("action") or "HOLD")
        price = cls._to_float(snapshot.get("price"))
        sma50 = cls._to_float(snapshot.get("fifty_day_sma"))
        sma200 = cls._to_float(snapshot.get("two_hundred_day_sma"))
        fair_value = cls._to_float(valuation.get("fair_value"))

        if price is None:
            plan_type = "AVOID" if action == "SELL" else "WAIT"
            return {
                "plan_type": plan_type,
                "entry_low": None,
                "entry_high": None,
                "stop_loss": None,
                "take_profit_1": None,
                "take_profit_2": None,
                "rr_to_tp1": None,
                "rr_to_tp2": None,
                "summary": {"key": "watchlist.trade_plan.summary.no_price", "params": {}},
            }

        support_anchor = price
        if sma50 is not None:
            support_anchor = min(price, sma50)

        entry_low = support_anchor * 0.98
        entry_high = support_anchor * 1.01

        stop_candidates: list[float] = []
        if sma200 is not None:
            stop_candidates.append(sma200 * 0.97)
        stop_candidates.append(entry_low * 0.95)
        if sma50 is not None:
            stop_candidates.append(sma50 * 0.93)
        stop_loss = min(stop_candidates) if stop_candidates else None

        if stop_loss is not None and stop_loss >= entry_low:
            stop_loss = entry_low * 0.95

        if action == "BUY":
            plan_type = "LONG"
            if fair_value is not None and fair_value > price:
                take_profit_1 = price + (fair_value - price) * 0.5
                take_profit_2 = fair_value
            else:
                take_profit_1 = price * 1.12
                take_profit_2 = price * 1.22
            summary_key = "bullish"
        elif action == "HOLD":
            plan_type = "WAIT"
            if fair_value is not None and fair_value > price:
                take_profit_1 = price + (fair_value - price) * 0.4
                take_profit_2 = fair_value
            else:
                take_profit_1 = price * 1.08
                take_profit_2 = price * 1.15
            summary_key = "mixed"
        else:
            plan_type = "AVOID"
            take_profit_1 = None
            take_profit_2 = None
            summary_key = "avoid"

        rr_to_tp1 = None
        rr_to_tp2 = None
        risk = (entry_high - stop_loss) if stop_loss is not None else None
        if risk is not None and risk > 0 and take_profit_1 is not None and take_profit_1 > entry_high:
            rr_to_tp1 = (take_profit_1 - entry_high) / risk
        if risk is not None and risk > 0 and take_profit_2 is not None and take_profit_2 > entry_high:
            rr_to_tp2 = (take_profit_2 - entry_high) / risk

        return {
            "plan_type": plan_type,
            "entry_low": cls._round(entry_low),
            "entry_high": cls._round(entry_high),
            "stop_loss": cls._round(stop_loss),
            "take_profit_1": cls._round(take_profit_1),
            "take_profit_2": cls._round(take_profit_2),
            "rr_to_tp1": cls._round(rr_to_tp1),
            "rr_to_tp2": cls._round(rr_to_tp2),
            "summary": {"key": f"watchlist.trade_plan.summary.{summary_key}", "params": {}},
        }

    @classmethod
    def _assemble_item(
        cls,
        row: tuple,
        screener: dict[str, Any] | None,
        technicals: dict[str, Any] | None,
    ) -> dict[str, Any]:
        symbol = cls._normalize_symbol(row[1])
        snapshot = screener or {"symbol": symbol}
        tech = technicals or {}
        valuation = cls._compute_dcf_valuation(snapshot)
        signal = cls._compute_signal(snapshot, tech, valuation)
        quality = cls._compute_quality_profile(valuation)
        value_trap = cls._compute_value_trap_risk(snapshot, tech, valuation, quality)
        cycle_profile = cls._compute_cycle_profile(snapshot, tech, valuation, quality)
        timing = cls._compute_timing_signal(
            snapshot,
            tech,
            signal,
            valuation,
            quality,
            value_trap,
            cycle_profile,
        )
        trade_plan = cls._compute_trade_plan(snapshot, signal, valuation)

        # Structure technical warnings
        raw_warnings = tech.get("warnings") or []
        structured_warnings = []
        for w in raw_warnings:
            if "Overbought" in w:
                rsi = cls._to_float(tech.get("rsi14"))
                structured_warnings.append({"key": "watchlist.technicals.warnings.overbought", "params": {"rsi": rsi}})
            elif "Oversold" in w:
                rsi = cls._to_float(tech.get("rsi14"))
                structured_warnings.append({"key": "watchlist.technicals.warnings.oversold", "params": {"rsi": rsi}})
            elif "Near 52-Week High" in w:
                structured_warnings.append({"key": "watchlist.technicals.warnings.high_52w", "params": {}})
            elif "Near 52-Week Low" in w:
                structured_warnings.append({"key": "watchlist.technicals.warnings.low_52w", "params": {}})
            else:
                structured_warnings.append({"key": "watchlist.technicals.warnings.generic", "params": {"msg": w}})

        return {
            "symbol": symbol,
            "name": snapshot.get("name"),
            "sector": snapshot.get("sector"),
            "industry": snapshot.get("industry"),
            "price": cls._to_float(snapshot.get("price")),
            "market_cap": cls._to_float(snapshot.get("market_cap")),
            "forward_pe": cls._to_float(snapshot.get("forward_pe")),
            "trailing_pe": cls._to_float(snapshot.get("trailing_pe")),
            "peg_ratio": cls._to_float(snapshot.get("peg_ratio")),
            "price_to_fcf": cls._to_float(snapshot.get("price_to_fcf")),
            "revenue_growth": cls._to_float(snapshot.get("revenue_growth")),
            "eps_growth": cls._to_float(snapshot.get("eps_growth")),
            "free_cash_flow": cls._to_float(snapshot.get("free_cash_flow")),
            "roic": cls._to_float(snapshot.get("roic")),
            "roe": cls._to_float(snapshot.get("roe")),
            "updated_at": snapshot.get("updated_at"),
            "added_at": row[3],
            "note": row[2],
            "signal": signal,
            "technical": {
                "rsi14": cls._to_float(tech.get("rsi14")),
                "fifty_two_week_position": cls._to_float(tech.get("fifty_two_week_position")),
                "warnings": structured_warnings,
            },
            "quality": quality,
            "value_trap": value_trap,
            "cycle_profile": cycle_profile,
            "timing": timing,
            "valuation": valuation,
            "trade_plan": trade_plan,
        }

    @classmethod
    def simulate_dcf(cls, req: dict[str, Any]) -> dict[str, Any]:
        """Perform a two-stage DCF simulation with custom parameters."""
        price = req["price"]
        e0 = req["base_value"]
        g1 = req["growth_rate"]
        d = req["discount_rate"]
        n = req["growth_years"]
        g2 = req["terminal_growth"]
        m = req["terminal_years"]
        tbv = req["tangible_book_value"]
        add_tbv = req["add_tangible_book"]

        def calc_present_value(base, growth, discount, years):
            x = (1 + growth) / (1 + discount)
            if abs(x - 1.0) < 1e-6:
                return base * years * x
            return base * x * (1 - x**years) / (1 - x)

        # Stage 1: Growth Stage
        growth_value = calc_present_value(e0, g1, d, n)
        
        # Stage 2: Terminal Stage
        e_n = e0 * (1 + g1)**n
        terminal_value = calc_present_value(e_n, g2, d, m)
        
        # Intrinsic Value
        fair_value = growth_value + terminal_value
        if add_tbv:
            fair_value += tbv
            
        margin_of_safety = (fair_value - price) / fair_value if fair_value > 0 else -1.0
        
        # Implied Growth (Reverse DCF)
        # We can reuse _solve_implied_growth but need one that matches this specific formula
        implied_growth = None
        
        def f_growth(g_test):
            gv = calc_present_value(e0, g_test, d, n)
            en = e0 * (1 + g_test)**n
            tv = calc_present_value(en, g2, d, m)
            fv = gv + tv
            if add_tbv:
                fv += tbv
            return fv

        # Binary search for implied growth
        low, high = -0.5, 2.0
        if f_growth(low) <= price <= f_growth(high):
            for _ in range(40):
                mid = (low + high) / 2
                if f_growth(mid) < price:
                    low = mid
                else:
                    high = mid
            implied_growth = (low + high) / 2

        return {
            "fair_value": cls._round(fair_value),
            "growth_value": cls._round(growth_value),
            "terminal_value": cls._round(terminal_value),
            "margin_of_safety": cls._round(margin_of_safety),
            "implied_growth": cls._round(implied_growth)
        }

    @classmethod
    def _attach_peer_valuation_scores(
        cls,
        items: list[dict[str, Any]],
        screener_map: dict[str, dict[str, Any]],
    ) -> list[dict[str, Any]]:
        if not items:
            return items

        symbols = [cls._normalize_symbol(item.get("symbol", "")) for item in items]
        sectors_needed = {(screener_map.get(symbol) or {}).get("sector") for symbol in symbols} - {None}
        peer_dicts: list[dict[str, Any]] = []
        if sectors_needed:
            conn = db.get_connection()
            try:
                placeholders = ", ".join(["?"] * len(sectors_needed))
                rows_peers = conn.execute(
                    f"""
                    SELECT symbol, sector,
                           revenue_growth, gross_margin, price_to_sales, ev_to_revenue, roic,
                           profit_margin, price_to_book, roe, dividend_yield, debt_to_equity,
                           ev_to_ebitda, price_to_fcf, trailing_pe, current_ratio
                    FROM screener_data
                    WHERE sector IN ({placeholders})
                    """,
                    list(sectors_needed),
                ).fetchall()
            finally:
                conn.close()
            cols = [
                "symbol", "sector",
                "revenue_growth", "gross_margin", "price_to_sales", "ev_to_revenue", "roic",
                "profit_margin", "price_to_book", "roe", "dividend_yield", "debt_to_equity",
                "ev_to_ebitda", "price_to_fcf", "trailing_pe", "current_ratio",
            ]
            peer_dicts = [dict(zip(cols, row)) for row in rows_peers]

        val_scores = compute_valuation_scores(peer_dicts) if peer_dicts else {}

        for item in items:
            result = val_scores.get(item.get("symbol", ""))
            if result:
                item["valuation_score"] = result["score"]
                item["valuation_label"] = result["label"]
                item["valuation_low_confidence"] = result["low_confidence"]

        return items

    @classmethod
    def list_watchlist(cls) -> dict[str, Any]:
        rows = cls._get_item_rows()
        if not rows:
            return {"total": 0, "items": []}

        symbols = [cls._normalize_symbol(row[1]) for row in rows]
        screener_map = cls._get_screener_snapshot(symbols)
        technical_map = cls._get_technical_snapshot(symbols)

        items = [
            cls._assemble_item(
                row,
                screener=screener_map.get(cls._normalize_symbol(row[1])),
                technicals=technical_map.get(cls._normalize_symbol(row[1])),
            )
            for row in rows
        ]
        cls._attach_peer_valuation_scores(items, screener_map)
        return {"total": len(items), "items": items}

    @classmethod
    def _upsert(cls, symbol: str, note: str | None = None) -> None:
        normalized_symbol = cls._normalize_symbol(symbol)
        if not normalized_symbol:
            raise ValueError("Symbol is required")

        clean_note = (note or "").strip() or None
        now = datetime.now()
        conn = db.get_connection()
        try:
            existing = conn.execute(
                "SELECT id FROM watchlist_items WHERE symbol = ?",
                [normalized_symbol],
            ).fetchone()
            if existing:
                conn.execute(
                    """
                    UPDATE watchlist_items
                    SET note = ?, updated_at = ?
                    WHERE symbol = ?
                    """,
                    [clean_note, now, normalized_symbol],
                )
            else:
                conn.execute(
                    """
                    INSERT INTO watchlist_items (id, symbol, note, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    [str(uuid.uuid4()), normalized_symbol, clean_note, now, now],
                )
        finally:
            conn.close()

    @classmethod
    def _get_single(cls, symbol: str) -> dict[str, Any] | None:
        normalized_symbol = cls._normalize_symbol(symbol)
        rows = cls._get_item_rows()
        for row in rows:
            if cls._normalize_symbol(row[1]) == normalized_symbol:
                screener_map = cls._get_screener_snapshot([normalized_symbol])
                technical_map = cls._get_technical_snapshot([normalized_symbol])
                item = cls._assemble_item(
                    row,
                    screener=screener_map.get(normalized_symbol),
                    technicals=technical_map.get(normalized_symbol),
                )
                cls._attach_peer_valuation_scores([item], screener_map)
                return item
        return None

    @classmethod
    def add_symbol(cls, symbol: str, note: str | None = None) -> dict[str, Any]:
        normalized_symbol = cls._normalize_symbol(symbol)
        if not normalized_symbol:
            raise ValueError("Symbol is required")
        cls._upsert(normalized_symbol, note)
        item = cls._get_single(normalized_symbol)
        if item is None:
            raise ValueError("Failed to create watchlist item")
        return item

    @classmethod
    def update_note(cls, symbol: str, note: str | None) -> dict[str, Any] | None:
        normalized_symbol = cls._normalize_symbol(symbol)
        if not normalized_symbol:
            return None
        conn = db.get_connection()
        try:
            exists = conn.execute(
                "SELECT id FROM watchlist_items WHERE symbol = ?",
                [normalized_symbol],
            ).fetchone()
            if not exists:
                return None
        finally:
            conn.close()

        cls._upsert(normalized_symbol, note)
        return cls._get_single(normalized_symbol)

    @classmethod
    def remove_symbol(cls, symbol: str) -> bool:
        normalized_symbol = cls._normalize_symbol(symbol)
        if not normalized_symbol:
            return False
        conn = db.get_connection()
        try:
            existing = conn.execute(
                "SELECT id FROM watchlist_items WHERE symbol = ?",
                [normalized_symbol],
            ).fetchone()
            if not existing:
                return False
            conn.execute(
                "DELETE FROM watchlist_items WHERE symbol = ?",
                [normalized_symbol],
            )
            return True
        finally:
            conn.close()


watchlist_service = WatchlistService()
