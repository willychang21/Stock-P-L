"""
Unit tests for industry_valuation.py

Run with: pytest tests/test_industry_valuation.py -v
"""

import pytest
from app.services.industry_valuation import (
    compute_valuation_scores,
    get_valuation_score_for_symbol,
    _label,
)

# ----------------------------------------------------------------------
# Helper factory
# ----------------------------------------------------------------------


def make_stock(symbol, sector, **kwargs):
    base = {
        "symbol": symbol,
        "sector": sector,
        "trailing_pe": None,
        "forward_pe": None,
        "price_to_book": None,
        "price_to_sales": None,
        "ev_to_ebitda": None,
        "ev_to_revenue": None,
        "peg_ratio": None,
        "roe": None,
        "roa": None,
        "roic": None,
        "revenue_growth": None,
        "profit_margin": None,
        "gross_margin": None,
        "dividend_yield": None,
        "debt_to_equity": None,
        "current_ratio": None,
        "price_to_fcf": None,
        "updated_at": "2025-01-01T00:00:00",
    }
    base.update(kwargs)
    return base


# ----------------------------------------------------------------------
# Label helper
# ----------------------------------------------------------------------


def test_label_thresholds():
    assert _label(90) == "Undervalued"
    assert _label(80) == "Undervalued"
    assert _label(79) == "Fair"
    assert _label(60) == "Fair"
    assert _label(59) == "Elevated"
    assert _label(40) == "Elevated"
    assert _label(39) == "Expensive"
    assert _label(0) == "Expensive"


# ----------------------------------------------------------------------
# Financial sector: lower P/B → higher score
# ----------------------------------------------------------------------


def test_financial_lower_pb_scores_higher():
    stocks = [
        make_stock("BAC",  "Financial Services", price_to_book=0.8, roe=0.12, profit_margin=0.20),
        make_stock("WFC",  "Financial Services", price_to_book=1.2, roe=0.10, profit_margin=0.18),
        make_stock("USB",  "Financial Services", price_to_book=1.8, roe=0.09, profit_margin=0.15),
        make_stock("KEY",  "Financial Services", price_to_book=2.5, roe=0.07, profit_margin=0.10),
        make_stock("RF",   "Financial Services", price_to_book=3.0, roe=0.06, profit_margin=0.08),
    ]
    scores = compute_valuation_scores(stocks)

    # BAC has the lowest P/B and highest ROE → should score highest
    assert scores["BAC"]["score"] > scores["WFC"]["score"]
    assert scores["BAC"]["score"] > scores["RF"]["score"]

    # None should be low-confidence (5 peers)
    assert scores["BAC"]["low_confidence"] is False


# ----------------------------------------------------------------------
# Technology sector: higher revenue_growth → higher score
# ----------------------------------------------------------------------


def test_tech_higher_growth_scores_better():
    stocks = [
        make_stock("FAST", "Technology", revenue_growth=0.45, gross_margin=0.70, price_to_sales=5),
        make_stock("SLOW", "Technology", revenue_growth=0.05, gross_margin=0.40, price_to_sales=15),
        make_stock("MED1", "Technology", revenue_growth=0.20, gross_margin=0.55, price_to_sales=10),
        make_stock("MED2", "Technology", revenue_growth=0.18, gross_margin=0.50, price_to_sales=12),
        make_stock("MED3", "Technology", revenue_growth=0.12, gross_margin=0.45, price_to_sales=11),
    ]
    scores = compute_valuation_scores(stocks)
    assert scores["FAST"]["score"] > scores["SLOW"]["score"]
    assert scores["FAST"]["sector"] == "Technology"
    assert "revenue_growth" in scores["FAST"]["metrics_used"]


# ----------------------------------------------------------------------
# Low confidence when fewer than 5 peers
# ----------------------------------------------------------------------


def test_low_confidence_small_peer_group():
    stocks = [
        make_stock("A", "Healthcare", revenue_growth=0.30, gross_margin=0.60),
        make_stock("B", "Healthcare", revenue_growth=0.10, gross_margin=0.40),
        make_stock("C", "Healthcare", revenue_growth=0.20, gross_margin=0.50),
    ]
    scores = compute_valuation_scores(stocks)
    assert scores["A"]["low_confidence"] is True
    assert scores["B"]["low_confidence"] is True


# ----------------------------------------------------------------------
# NaN / None values should not crash
# ----------------------------------------------------------------------


def test_none_values_no_crash():
    stocks = [
        make_stock("X1", "Industrials"),  # All metrics None
        make_stock("X2", "Industrials", trailing_pe=20, roe=0.15),
        make_stock("X3", "Industrials", trailing_pe=30, roe=0.10),
        make_stock("X4", "Industrials", trailing_pe=15, roe=0.20),
        make_stock("X5", "Industrials", trailing_pe=25, roe=0.12),
    ]
    scores = compute_valuation_scores(stocks)
    # X1 has no data but should still get an entry (may get neutral score)
    # Most importantly: should not raise
    for sym in ["X1", "X2", "X3", "X4", "X5"]:
        assert sym in scores
        s = scores[sym]["score"]
        assert 0 <= s <= 100


# ----------------------------------------------------------------------
# Unknown / missing sector falls back to DEFAULT_METRICS
# ----------------------------------------------------------------------


def test_unknown_sector_uses_defaults():
    stocks = [
        make_stock("Z1", None, trailing_pe=10, roe=0.20, revenue_growth=0.15, roic=0.18),
        make_stock("Z2", None, trailing_pe=50, roe=0.05, revenue_growth=0.02, roic=0.05),
        make_stock("Z3", None, trailing_pe=25, roe=0.12, revenue_growth=0.08, roic=0.10),
        make_stock("Z4", None, trailing_pe=35, roe=0.08, revenue_growth=0.06, roic=0.07),
        make_stock("Z5", None, trailing_pe=20, roe=0.15, revenue_growth=0.12, roic=0.13),
    ]
    scores = compute_valuation_scores(stocks)
    # Z1 has best fundamentals → should score highest
    assert scores["Z1"]["score"] > scores["Z2"]["score"]


# ----------------------------------------------------------------------
# Sub-scores are present and sensible
# ----------------------------------------------------------------------


def test_sub_scores_populated():
    stocks = [
        make_stock("S1", "Utilities", dividend_yield=0.05, price_to_book=1.0, debt_to_equity=0.5, profit_margin=0.20),
        make_stock("S2", "Utilities", dividend_yield=0.02, price_to_book=2.0, debt_to_equity=1.5, profit_margin=0.10),
        make_stock("S3", "Utilities", dividend_yield=0.03, price_to_book=1.5, debt_to_equity=1.0, profit_margin=0.15),
        make_stock("S4", "Utilities", dividend_yield=0.04, price_to_book=1.2, debt_to_equity=0.8, profit_margin=0.18),
        make_stock("S5", "Utilities", dividend_yield=0.01, price_to_book=2.5, debt_to_equity=2.0, profit_margin=0.08),
    ]
    scores = compute_valuation_scores(stocks)
    sub = scores["S1"]["sub_scores"]
    assert len(sub) > 0
    for item in sub:
        assert 0 <= item["score"] <= 100
        assert "field" in item
        assert "weight" in item


# ----------------------------------------------------------------------
# get_valuation_score_for_symbol helper
# ----------------------------------------------------------------------


def test_get_valuation_score_for_symbol():
    stocks = [
        make_stock("AAPL", "Technology", revenue_growth=0.10, gross_margin=0.45, price_to_sales=7),
        make_stock("MSFT", "Technology", revenue_growth=0.15, gross_margin=0.69, price_to_sales=12),
        make_stock("GOOGL", "Technology", revenue_growth=0.12, gross_margin=0.56, price_to_sales=6),
        make_stock("META", "Technology", revenue_growth=0.20, gross_margin=0.80, price_to_sales=8),
        make_stock("AMZN", "Technology", revenue_growth=0.11, gross_margin=0.48, price_to_sales=3),
    ]
    result = get_valuation_score_for_symbol("AAPL", stocks)
    assert result is not None
    assert "score" in result
    assert "label" in result
    assert "sub_scores" in result

    # Non-existent symbol
    missing = get_valuation_score_for_symbol("NOPE", stocks)
    assert missing is None
