"""
Industry-aware Valuation Score Service
=======================================
Computes a 0–100 composite score for each stock relative to its sector peers.

Score meaning:
  80–100 → "Undervalued"  (top 20% most attractive in peer group)
  60–79  → "Fair"
  40–59  → "Elevated"
  0–39   → "Expensive"

Higher score = more attractive (cheaper valuation + stronger fundamentals).
Scores are percentile-based within each sector's available universe, not
absolute thresholds, so a 75 means "better than 75% of sector peers on DB".
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Sequence, TypedDict

# ---------------------------------------------------------------------------
# Sector metric configuration
# ---------------------------------------------------------------------------
# Each entry: (field_name, higher_is_better)
# higher_is_better=True  → higher raw value → higher score (e.g. ROE)
# higher_is_better=False → lower raw value  → higher score (e.g. P/E)
# ---------------------------------------------------------------------------

MetricSpec = tuple[str, bool, float]  # (field, higher_is_better, weight)


SECTOR_METRICS: Dict[str, List[MetricSpec]] = {
    # -----------------------------------------------------------------------
    # Technology / Communication Services / Consumer Discretionary (growth)
    # -----------------------------------------------------------------------
    "Technology": [
        ("revenue_growth",   True,  0.30),
        ("gross_margin",     True,  0.20),
        ("price_to_sales",   False, 0.20),
        ("ev_to_revenue",    False, 0.15),
        ("roic",             True,  0.15),
    ],
    "Communication Services": [
        ("revenue_growth",   True,  0.25),
        ("gross_margin",     True,  0.20),
        ("price_to_sales",   False, 0.20),
        ("roic",             True,  0.15),
        ("profit_margin",    True,  0.20),
    ],
    # -----------------------------------------------------------------------
    # Financial Services — P/B + ROE are the canonical valuation pair
    # -----------------------------------------------------------------------
    "Financial Services": [
        ("price_to_book",    False, 0.30),
        ("roe",              True,  0.30),
        ("profit_margin",    True,  0.20),
        ("dividend_yield",   True,  0.10),
        ("debt_to_equity",   False, 0.10),
    ],
    # -----------------------------------------------------------------------
    # Energy / Basic Materials — cash-flow multiples dominate
    # -----------------------------------------------------------------------
    "Energy": [
        ("ev_to_ebitda",     False, 0.30),
        ("price_to_fcf",     False, 0.25),
        ("debt_to_equity",   False, 0.20),
        ("roic",             True,  0.15),
        ("profit_margin",    True,  0.10),
    ],
    "Basic Materials": [
        ("ev_to_ebitda",     False, 0.30),
        ("price_to_fcf",     False, 0.25),
        ("debt_to_equity",   False, 0.20),
        ("roic",             True,  0.15),
        ("profit_margin",    True,  0.10),
    ],
    # -----------------------------------------------------------------------
    # Healthcare — P/S + growth; P/E & P/FCF often useless for early-stage
    # -----------------------------------------------------------------------
    "Healthcare": [
        ("revenue_growth",   True,  0.30),
        ("price_to_sales",   False, 0.25),
        ("gross_margin",     True,  0.25),
        ("profit_margin",    True,  0.20),
    ],
    # -----------------------------------------------------------------------
    # Consumer Defensive / Consumer Cyclical
    # -----------------------------------------------------------------------
    "Consumer Defensive": [
        ("trailing_pe",      False, 0.25),
        ("roe",              True,  0.25),
        ("profit_margin",    True,  0.20),
        ("dividend_yield",   True,  0.15),
        ("current_ratio",    True,  0.15),
    ],
    "Consumer Cyclical": [
        ("trailing_pe",      False, 0.25),
        ("revenue_growth",   True,  0.25),
        ("roe",              True,  0.20),
        ("profit_margin",    True,  0.20),
        ("current_ratio",    True,  0.10),
    ],
    # -----------------------------------------------------------------------
    # Industrials — mix of P/E and quality metrics
    # -----------------------------------------------------------------------
    "Industrials": [
        ("trailing_pe",      False, 0.25),
        ("roe",              True,  0.25),
        ("revenue_growth",   True,  0.20),
        ("roic",             True,  0.20),
        ("profit_margin",    True,  0.10),
    ],
    # -----------------------------------------------------------------------
    # Utilities / Real Estate — yield + balance sheet
    # -----------------------------------------------------------------------
    "Utilities": [
        ("dividend_yield",   True,  0.35),
        ("price_to_book",    False, 0.25),
        ("debt_to_equity",   False, 0.25),
        ("profit_margin",    True,  0.15),
    ],
    "Real Estate": [
        ("dividend_yield",   True,  0.35),
        ("price_to_book",    False, 0.25),
        ("debt_to_equity",   False, 0.20),
        ("profit_margin",    True,  0.20),
    ],
}

# Fall-back when sector is unknown / not in config
DEFAULT_METRICS: List[MetricSpec] = [
    ("trailing_pe",   False, 0.25),
    ("roe",           True,  0.25),
    ("revenue_growth", True, 0.25),
    ("roic",          True,  0.25),
]

SCORE_LABELS = [
    (80, "Undervalued"),
    (60, "Fair"),
    (40, "Elevated"),
    (0,  "Expensive"),
]


def _label(score: float) -> str:
    for threshold, label in SCORE_LABELS:
        if score >= threshold:
            return label
    return "Expensive"


class SubScore(TypedDict):
    field: str
    score: float
    raw_value: Optional[float]
    higher_is_better: bool
    weight: float


class ValuationResult(TypedDict):
    score: float
    label: str
    low_confidence: bool
    sector: str
    metrics_used: List[str]
    sub_scores: List[SubScore]


# ---------------------------------------------------------------------------
# Core computation
# ---------------------------------------------------------------------------

def _percentile_rank(value: float, peer_values: List[float]) -> float:
    """
    Return percentile rank of *value* within *peer_values* (0–100).
    Equals the fraction of peers that are strictly below this value × 100.
    """
    if not peer_values:
        return 50.0
    below = sum(1 for v in peer_values if v < value)
    return (below / len(peer_values)) * 100.0


def _safe_float(value: Any) -> Optional[float]:
    try:
        v = float(value)
        import math
        if math.isnan(v) or math.isinf(v):
            return None
        return v
    except (TypeError, ValueError):
        return None


def compute_valuation_scores(
    stocks: List[Dict[str, Any]],
) -> Dict[str, ValuationResult]:
    """
    Compute Industry Valuation Scores for an arbitrary list of stock dicts.

    Parameters
    ----------
    stocks : list of dicts with at minimum 'symbol' and 'sector' keys;
             all other metric fields are optional (None-safe).

    Returns
    -------
    Dict mapping symbol → ValuationResult
    """
    # Group stocks by sector
    sectors: Dict[str, List[Dict[str, Any]]] = {}
    for stock in stocks:
        s = (stock.get("sector") or "Unknown").strip()
        sectors.setdefault(s, []).append(stock)

    results: Dict[str, ValuationResult] = {}

    for sector_name, peers in sectors.items():
        metrics = SECTOR_METRICS.get(sector_name, DEFAULT_METRICS)
        low_confidence = len(peers) < 5

        # Pre-collect valid (non-None) values per metric across all peers
        peer_field_values: Dict[str, List[float]] = {}
        for field, _, _ in metrics:
            vals = [
                v for p in peers
                if (v := _safe_float(p.get(field))) is not None
            ]
            peer_field_values[field] = vals

        for stock in peers:
            symbol = stock.get("symbol", "UNKNOWN")
            sub_scores: List[SubScore] = []
            weighted_sum = 0.0
            total_weight = 0.0

            for field, higher_is_better, weight in metrics:
                raw = _safe_float(stock.get(field))
                peer_vals = peer_field_values.get(field, [])

                if raw is None or not peer_vals:
                    # Skip metric — no data
                    continue

                # Compute percentile from the right direction
                if higher_is_better:
                    pct = _percentile_rank(raw, peer_vals)
                else:
                    # Invert: lower raw → higher score
                    pct = 100.0 - _percentile_rank(raw, peer_vals)

                # Edge-case: if all peers have the same value, rank is 0;
                # assign neutral 50 so it doesn't punish/reward unfairly.
                if len(set(peer_vals)) == 1:
                    pct = 50.0

                sub_scores.append(
                    SubScore(
                        field=field,
                        score=round(pct, 1),
                        raw_value=raw,
                        higher_is_better=higher_is_better,
                        weight=weight,
                    )
                )
                weighted_sum += pct * weight
                total_weight += weight

            if total_weight == 0:
                composite = 50.0
            else:
                composite = weighted_sum / total_weight

            composite = max(0.0, min(100.0, composite))

            results[symbol] = ValuationResult(
                score=round(composite, 1),
                label=_label(composite),
                low_confidence=low_confidence,
                sector=sector_name,
                metrics_used=[f for f, _, _ in metrics],
                sub_scores=sub_scores,
            )

    return results


def get_valuation_score_for_symbol(
    symbol: str,
    all_stocks: List[Dict[str, Any]],
) -> Optional[ValuationResult]:
    """Compute valuation scores for all stocks and return the one for *symbol*."""
    scores = compute_valuation_scores(all_stocks)
    return scores.get(symbol.upper())
