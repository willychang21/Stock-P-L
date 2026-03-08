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
    quality = WatchlistService._compute_quality_profile(snapshot, valuation)
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
    quality = WatchlistService._compute_quality_profile(snapshot, valuation)
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


def test_semiconductor_rebound_is_flagged_for_peak_earnings_cycle_risk():
    snapshot = {
        "symbol": "MU",
        "name": "Micron Technology, Inc.",
        "sector": "Technology",
        "industry": "Semiconductors",
        "price": 429.0,
        "market_cap": 482_843_459_584.0,
        "free_cash_flow": 444_249_984.0,
        "revenue_growth": 0.567,
        "eps_growth": 1.802,
        "forward_pe": 9.628834,
        "trailing_pe": 40.818268,
        "peg_ratio": 0.1752,
        "price_to_fcf": 10.9,
        "roic": 0.311,
        "roe": 0.225,
        "profit_margin": 0.18,
        "operating_margin": 0.22,
        "gross_margin": 0.41,
        "debt_to_equity": 18.0,
        "current_ratio": 2.1,
        "beta": 1.45,
        "total_debt": 12_000_000_000.0,
        "total_cash": 18_000_000_000.0,
        "updated_at": datetime.now() - timedelta(days=2),
    }
    technicals = {
        "rsi14": 42.6,
        "fifty_two_week_position": 0.78,
        "warnings": ["Near 52-Week High"],
    }

    valuation = WatchlistService._compute_dcf_valuation(snapshot)
    signal = WatchlistService._compute_signal(snapshot, technicals, valuation)
    quality = WatchlistService._compute_quality_profile(snapshot, valuation)
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


def test_storage_hardware_turnaround_is_not_marked_as_steady():
    snapshot = {
        "symbol": "SNDK",
        "name": "Sandisk Corporation",
        "sector": "Technology",
        "industry": "Computer Hardware",
        "price": 632.38,
        "market_cap": 93_318_578_176.0,
        "free_cash_flow": 1_251_500_032.0,
        "revenue_growth": 0.612,
        "eps_growth": 6.721,
        "forward_pe": 7.8170652,
        "profit_margin": -0.117,
        "operating_margin": -0.102,
        "gross_margin": 0.31,
        "roe": -0.0937,
        "debt_to_equity": 48.0,
        "current_ratio": 1.7,
        "beta": 1.38,
        "updated_at": datetime.now() - timedelta(days=9),
    }
    technicals = {
        "rsi14": 43.88,
        "fifty_two_week_position": 0.71,
        "warnings": [],
    }

    valuation = WatchlistService._compute_dcf_valuation(snapshot)
    signal = WatchlistService._compute_signal(snapshot, technicals, valuation)
    quality = WatchlistService._compute_quality_profile(snapshot, valuation)
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

    assert quality["score"] < 80
    assert cycle_profile["is_cyclical"] is True
    assert cycle_profile["peak_earnings_risk"] in {"MEDIUM", "HIGH"}
    assert value_trap["score"] >= 28
    assert timing["status"] != "READY"


def test_financial_coverage_uses_framework_specific_inputs():
    snapshot = {
        "symbol": "SOFI",
        "sector": "Financial Services",
        "industry": "Credit Services",
        "price": 19.29,
        "market_cap": 24_599_840_768.0,
        "forward_pe": 24.429783,
        "trailing_pe": 49.461544,
        "price_to_book": 3.4,
        "revenue_growth": 0.402,
        "eps_growth": -0.478,
        "roe": 0.05658,
        "debt_to_equity": 61.0,
        "recommendation_mean": 2.2,
        "updated_at": datetime.now() - timedelta(days=2),
    }
    technicals = {
        "rsi14": 39.17,
        "fifty_two_week_position": 0.42,
        "warnings": [],
    }

    valuation = WatchlistService._compute_dcf_valuation(snapshot)
    signal = WatchlistService._compute_signal(snapshot, technicals, valuation)

    assert valuation["status"] == "UNAVAILABLE"
    assert signal["coverage_breakdown"]["framework"] == "FINANCIAL"
    assert signal["data_coverage"] >= 0.75
    assert signal["coverage_breakdown"]["valuation"]["have"] == 1
    assert "valuation_context" not in signal["coverage_breakdown"]["missing_groups"]


def test_unprofitable_growth_coverage_uses_sales_context():
    snapshot = {
        "symbol": "ONDS",
        "sector": "Technology",
        "industry": "Communication Equipment",
        "price": 10.3,
        "market_cap": 4_635_948_544.0,
        "price_to_sales": 14.5,
        "ev_to_revenue": 12.2,
        "revenue_growth": 5.82,
        "eps_growth": -0.25,
        "free_cash_flow": -14_134_830.0,
        "profit_margin": -1.725,
        "gross_margin": 0.47,
        "ebitda_margin": -0.22,
        "debt_to_equity": 12.0,
        "inst_own_percent": 0.41,
        "short_percent": 0.07,
        "updated_at": datetime.now() - timedelta(days=2),
    }
    technicals = {
        "rsi14": 45.98,
        "fifty_two_week_position": 0.63,
        "warnings": [],
    }

    valuation = WatchlistService._compute_dcf_valuation(snapshot)
    signal = WatchlistService._compute_signal(snapshot, technicals, valuation)

    assert valuation["status"] == "UNAVAILABLE"
    assert signal["coverage_breakdown"]["framework"] == "UNPROFITABLE"
    assert signal["data_coverage"] >= 0.75
    assert "sales_multiple" not in signal["coverage_breakdown"]["missing_groups"]
    assert "valuation_context" not in signal["coverage_breakdown"]["missing_groups"]


def test_missing_or_thin_snapshot_is_marked_for_enrichment():
    assert WatchlistService._needs_screener_enrichment(None) is True

    complete_snapshot = {
        "name": "Complete Co",
        "price": 100.0,
        "market_cap": 10_000_000_000.0,
        "sector": "Technology",
        "industry": "Software - Infrastructure",
        "forward_pe": 20.0,
        "trailing_pe": 22.0,
        "revenue_growth": 0.18,
        "eps_growth": 0.2,
        "free_cash_flow": 1_000_000_000.0,
        "roic": 0.22,
        "roe": 0.25,
        "updated_at": datetime.now(),
    }
    thin_snapshot = {
        "name": None,
        "price": None,
        "market_cap": None,
        "sector": "Technology",
        "industry": "Computer Hardware",
        "forward_pe": None,
        "trailing_pe": None,
        "revenue_growth": None,
        "eps_growth": None,
        "free_cash_flow": None,
        "roic": None,
        "roe": None,
        "updated_at": datetime.now() - timedelta(days=6),
    }

    assert WatchlistService._needs_screener_enrichment(complete_snapshot) is False
    assert WatchlistService._needs_screener_enrichment(thin_snapshot) is True
