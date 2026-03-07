from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List

class ScreenerStock(BaseModel):
    symbol: str
    name: Optional[str] = None
    price: Optional[float] = None
    market_cap: Optional[float] = None
    trailing_pe: Optional[float] = None
    forward_pe: Optional[float] = None
    price_to_sales: Optional[float] = None
    price_to_book: Optional[float] = None
    ev_to_ebitda: Optional[float] = None
    ev_to_revenue: Optional[float] = None
    peg_ratio: Optional[float] = None
    profit_margin: Optional[float] = None
    operating_margin: Optional[float] = None
    roe: Optional[float] = None
    roa: Optional[float] = None
    revenue_growth: Optional[float] = None
    earnings_growth: Optional[float] = None
    eps_growth: Optional[float] = None
    dividend_yield: Optional[float] = None
    payout_ratio: Optional[float] = None
    debt_to_equity: Optional[float] = None
    current_ratio: Optional[float] = None
    fifty_day_sma: Optional[float] = None
    two_hundred_day_sma: Optional[float] = None
    fifty_two_week_high: Optional[float] = None
    fifty_two_week_low: Optional[float] = None
    price_to_fcf: Optional[float] = None
    free_cash_flow: Optional[float] = None
    roic: Optional[float] = None
    total_debt: Optional[float] = None
    total_equity: Optional[float] = None
    total_cash: Optional[float] = None
    operating_income: Optional[float] = None
    tax_rate: Optional[float] = None
    target_upside: Optional[float] = None
    recommendation_mean: Optional[float] = None
    short_percent: Optional[float] = None
    inst_own_percent: Optional[float] = None
    insider_own_percent: Optional[float] = None
    beta: Optional[float] = None
    gross_margin: Optional[float] = None
    ebitda_margin: Optional[float] = None
    has_options: Optional[bool] = False
    sector: Optional[str] = None
    industry: Optional[str] = None
    updated_at: datetime
    # Runtime-computed — not stored in DB
    valuation_score: Optional[float] = None
    valuation_label: Optional[str] = None
    valuation_low_confidence: Optional[bool] = None

class ScreenerResponse(BaseModel):
    total: int
    items: List[ScreenerStock]
