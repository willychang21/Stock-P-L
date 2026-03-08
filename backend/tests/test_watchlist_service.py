from datetime import datetime, timedelta

from app.services.watchlist_service import WatchlistService


def test_ready_compounder_profile():
    snapshot = {
        "symbol": "QUALITY",
        "sector": "Technology",
        "industry": "Software - Infrastructure",
        "price": 100.0,
        "market_cap": 200_000_000_000.0,
        "free_cash_flow": 8_000_000_000.0,
        "revenue_growth": 0.18,
        "eps_growth": 0.22,
        "forward_pe": 20.0,
        "trailing_pe": 20.0,
        "peg_ratio": 1.1,
        "price_to_fcf": 16.0,
        "roic": 0.22,
        "roe": 0.28,
        "profit_margin": 0.26,
        "operating_margin": 0.30,
        "gross_margin": 0.64,
        "debt_to_equity": 25.0,
        "current_ratio": 1.8,
        "beta": 0.95,
        "total_debt": 20_000_000_000.0,
        "total_cash": 15_000_000_000.0,
        "updated_at": datetime.now() - timedelta(days=1),
    }
    technicals = {
        "rsi14": 42.0,
        "fifty_two_week_position": 0.34,
        "warnings": [],
    }

    valuation = WatchlistService._compute_dcf_valuation(snapshot)
    signal = WatchlistService._compute_signal(snapshot, technicals, valuation)
    quality = WatchlistService._compute_quality_profile(valuation)
    cycle_profile = WatchlistService._compute_cycle_profile(
        snapshot,
        technicals,
        valuation,
        quality,
    )
    value_trap = WatchlistService._compute_value_trap_risk(
        snapshot,
        technicals,
        valuation,
        quality,
    )
    timing = WatchlistService._compute_timing_signal(
        snapshot,
        technicals,
        signal,
        valuation,
        quality,
        value_trap,
        cycle_profile,
    )

    assert valuation["status"] == "AVAILABLE"
    assert quality["score"] >= 75
    assert cycle_profile["is_cyclical"] is False
    assert value_trap["level"] == "LOW"
    assert timing["status"] == "READY"


def test_cheap_but_fragile_profile_is_flagged_as_value_trap():
    snapshot = {
        "symbol": "TRAP",
        "sector": "Consumer Cyclical",
        "industry": "Retail - Apparel",
        "price": 20.0,
        "market_cap": 10_000_000_000.0,
        "free_cash_flow": 250_000_000.0,
        "revenue_growth": -0.08,
        "eps_growth": -0.12,
        "forward_pe": 8.0,
        "trailing_pe": 9.0,
        "peg_ratio": 0.7,
        "price_to_fcf": 10.0,
        "roic": 0.03,
        "roe": 0.04,
        "profit_margin": 0.04,
        "operating_margin": 0.05,
        "gross_margin": 0.18,
        "debt_to_equity": 180.0,
        "current_ratio": 0.78,
        "beta": 1.4,
        "total_debt": 4_000_000_000.0,
        "total_cash": 300_000_000.0,
        "updated_at": datetime.now() - timedelta(days=21),
    }
    technicals = {
        "rsi14": 57.0,
        "fifty_two_week_position": 0.08,
        "warnings": ["Near 52-Week Low"],
    }

    valuation = WatchlistService._compute_dcf_valuation(snapshot)
    signal = WatchlistService._compute_signal(snapshot, technicals, valuation)
    quality = WatchlistService._compute_quality_profile(valuation)
    cycle_profile = WatchlistService._compute_cycle_profile(
        snapshot,
        technicals,
        valuation,
        quality,
    )
    value_trap = WatchlistService._compute_value_trap_risk(
        snapshot,
        technicals,
        valuation,
        quality,
    )
    timing = WatchlistService._compute_timing_signal(
        snapshot,
        technicals,
        signal,
        valuation,
        quality,
        value_trap,
        cycle_profile,
    )

    assert quality["score"] < 55
    assert value_trap["level"] == "HIGH"
    assert any(
        reason["key"] == "watchlist.valueTrap.reasons.revenue_negative"
        for reason in value_trap["reasons"]
    )
    assert timing["status"] in {"STALE", "AVOID"}


def test_memory_name_is_flagged_for_peak_earnings_cycle_risk():
    snapshot = {
        "symbol": "MEM",
        "sector": "Technology",
        "industry": "Semiconductor Memory",
        "price": 120.0,
        "market_cap": 140_000_000_000.0,
        "free_cash_flow": 9_000_000_000.0,
        "revenue_growth": 0.24,
        "eps_growth": 0.48,
        "forward_pe": 8.5,
        "trailing_pe": 9.5,
        "peg_ratio": 0.9,
        "price_to_fcf": 11.0,
        "roic": 0.19,
        "roe": 0.21,
        "profit_margin": 0.24,
        "operating_margin": 0.26,
        "gross_margin": 0.46,
        "debt_to_equity": 18.0,
        "current_ratio": 2.1,
        "beta": 1.45,
        "total_debt": 12_000_000_000.0,
        "total_cash": 18_000_000_000.0,
        "updated_at": datetime.now() - timedelta(days=2),
    }
    technicals = {
        "rsi14": 61.0,
        "fifty_two_week_position": 0.82,
        "warnings": ["Near 52-Week High"],
    }

    valuation = WatchlistService._compute_dcf_valuation(snapshot)
    signal = WatchlistService._compute_signal(snapshot, technicals, valuation)
    quality = WatchlistService._compute_quality_profile(valuation)
    cycle_profile = WatchlistService._compute_cycle_profile(
        snapshot,
        technicals,
        valuation,
        quality,
    )
    value_trap = WatchlistService._compute_value_trap_risk(
        snapshot,
        technicals,
        valuation,
        quality,
    )
    timing = WatchlistService._compute_timing_signal(
        snapshot,
        technicals,
        signal,
        valuation,
        quality,
        value_trap,
        cycle_profile,
    )

    assert cycle_profile["is_cyclical"] is True
    assert cycle_profile["price_taker"] is True
    assert cycle_profile["earnings_regime"] == "PEAK"
    assert cycle_profile["peak_earnings_risk"] == "HIGH"
    assert cycle_profile["normalized_pe"] is not None
    assert cycle_profile["normalized_pe"] > cycle_profile["summary"]["params"]["pe"]
    assert timing["status"] != "READY"
