from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class I18nMessage(BaseModel):
    key: str
    params: dict[str, Any] = Field(default_factory=dict)


class WatchlistSearchItem(BaseModel):
    symbol: str
    name: str | None = None
    sector: str | None = None
    industry: str | None = None
    price: float | None = None
    market_cap: float | None = None


class WatchlistAddRequest(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=20)
    note: str | None = Field(default=None, max_length=280)


class WatchlistUpdateRequest(BaseModel):
    note: str | None = Field(default=None, max_length=280)


class WatchlistSignal(BaseModel):
    action: Literal["BUY", "HOLD", "SELL"]
    score: float
    confidence: int
    data_coverage: float
    freshness_days: int | None = None
    reasons: list[I18nMessage] = Field(default_factory=list)


class WatchlistTechnical(BaseModel):
    rsi14: float | None = None
    fifty_two_week_position: float | None = None
    warnings: list[I18nMessage] = Field(default_factory=list)


class WatchlistValuationScenario(BaseModel):
    label: Literal["BEAR", "BASE", "BULL"]
    fcf_growth_5y: float
    discount_rate: float
    fair_value: float


class WatchlistValuation(BaseModel):
    model: Literal["DCF"] = "DCF"
    status: Literal["AVAILABLE", "UNAVAILABLE"]
    valuation_method: Literal["GF_BLEND_DCF_MULTIPLE"] | None = None
    valuation_label: Literal["DISCOUNT", "FAIR", "PREMIUM", "EXTREME_PREMIUM"] | None = None
    fair_value: float | None = None
    dcf_fair_value: float | None = None
    dcf_upside_pct: float | None = None
    fair_value_low: float | None = None
    fair_value_high: float | None = None
    upside_pct: float | None = None
    implied_growth_10y: float | None = None
    discount_rate: float | None = None
    terminal_growth: float | None = None
    fcf_growth_5y: float | None = None
    base_fcf: float | None = None
    shares_outstanding: float | None = None
    net_debt: float | None = None
    risk_free_rate: float | None = None
    equity_risk_premium: float | None = None
    profitability_rank: int | None = None
    growth_rank: int | None = None
    financial_strength_rank: int | None = None
    valuation_rank: int | None = None
    gf_score: int | None = None
    scenarios: list[WatchlistValuationScenario] = Field(default_factory=list)
    confidence: int
    summary: I18nMessage


class WatchlistTradePlan(BaseModel):
    plan_type: Literal["LONG", "WAIT", "AVOID"]
    entry_low: float | None = None
    entry_high: float | None = None
    stop_loss: float | None = None
    take_profit_1: float | None = None
    take_profit_2: float | None = None
    rr_to_tp1: float | None = None
    rr_to_tp2: float | None = None
    summary: I18nMessage


class WatchlistDCFSimulationRequest(BaseModel):
    symbol: str
    price: float
    base_value: float  # EPS or FCF
    discount_rate: float
    growth_rate: float
    growth_years: int = 10
    terminal_growth: float = 0.04
    terminal_years: int = 10
    tangible_book_value: float = 0.0
    add_tangible_book: bool = False


class WatchlistDCFSimulationResponse(BaseModel):
    fair_value: float
    growth_value: float
    terminal_value: float
    margin_of_safety: float
    implied_growth: float | None = None


class WatchlistItem(BaseModel):
    symbol: str
    name: str | None = None
    sector: str | None = None
    industry: str | None = None
    price: float | None = None
    market_cap: float | None = None
    forward_pe: float | None = None
    trailing_pe: float | None = None
    peg_ratio: float | None = None
    price_to_fcf: float | None = None
    revenue_growth: float | None = None
    eps_growth: float | None = None
    free_cash_flow: float | None = None
    roic: float | None = None
    roe: float | None = None
    updated_at: datetime | None = None
    added_at: datetime
    note: str | None = None
    signal: WatchlistSignal
    technical: WatchlistTechnical
    valuation: WatchlistValuation
    trade_plan: WatchlistTradePlan
    # Runtime-computed — not stored in DB
    valuation_score: float | None = None
    valuation_label: str | None = None
    valuation_low_confidence: bool | None = None


class WatchlistResponse(BaseModel):
    total: int
    items: list[WatchlistItem]
