export type WatchSignalAction = 'BUY' | 'HOLD' | 'SELL';

export interface WatchlistSearchItem {
  symbol: string;
  name?: string;
  sector?: string;
  industry?: string;
  price?: number;
  market_cap?: number;
}

export interface I18nMessage {
  key: string;
  params?: Record<string, any>;
}

export interface WatchlistCoverageBucket {
  have: number;
  total: number;
}

export interface WatchlistCoverageBreakdown {
  framework: 'GENERAL' | 'CYCLICAL' | 'FINANCIAL' | 'UNPROFITABLE';
  fundamentals: WatchlistCoverageBucket;
  technical: WatchlistCoverageBucket;
  valuation: WatchlistCoverageBucket;
  missing_groups: string[];
}

export interface WatchlistSignal {
  action: WatchSignalAction;
  score: number;
  confidence: number;
  data_coverage: number;
  coverage_breakdown?: WatchlistCoverageBreakdown;
  freshness_days?: number;
  reasons: I18nMessage[];
}

export interface WatchlistTechnical {
  rsi14?: number;
  fifty_two_week_position?: number;
  warnings: I18nMessage[];
}

export interface WatchlistQualityProfile {
  score: number;
  outlook: 'ELITE' | 'STRONG' | 'AVERAGE' | 'SPECULATIVE';
  profitability?: number;
  growth?: number;
  financial_strength?: number;
  valuation_support?: number;
  summary: I18nMessage;
}

export interface WatchlistValueTrapRisk {
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  score: number;
  reasons: I18nMessage[];
}

export interface WatchlistCycleProfile {
  is_cyclical: boolean;
  price_taker: boolean;
  earnings_regime: 'STEADY' | 'TROUGH' | 'MID' | 'PEAK';
  peak_earnings_risk: 'LOW' | 'MEDIUM' | 'HIGH';
  score: number;
  normalized_pe?: number;
  summary: I18nMessage;
  reasons: I18nMessage[];
}

export interface WatchlistTimingSignal {
  status: 'READY' | 'WAIT_PULLBACK' | 'WAIT_CONFIRMATION' | 'STALE' | 'AVOID';
  score: number;
  freshness_days?: number;
  summary: I18nMessage;
  conditions: I18nMessage[];
}

export interface WatchlistValuation {
  model: 'DCF';
  status: 'AVAILABLE' | 'UNAVAILABLE';
  valuation_method?: 'GF_BLEND_DCF_MULTIPLE';
  valuation_label?: 'DISCOUNT' | 'FAIR' | 'PREMIUM' | 'EXTREME_PREMIUM';
  fair_value?: number;
  dcf_fair_value?: number;
  dcf_upside_pct?: number;
  fair_value_low?: number;
  fair_value_high?: number;
  upside_pct?: number;
  implied_growth_10y?: number;
  discount_rate?: number;
  terminal_growth?: number;
  fcf_growth_5y?: number;
  base_fcf?: number;
  shares_outstanding?: number;
  net_debt?: number;
  risk_free_rate?: number;
  equity_risk_premium?: number;
  profitability_rank?: number;
  growth_rank?: number;
  financial_strength_rank?: number;
  valuation_rank?: number;
  gf_score?: number;
  scenarios?: {
    label: 'BEAR' | 'BASE' | 'BULL';
    fcf_growth_5y: number;
    discount_rate: number;
    fair_value: number;
  }[];
  confidence: number;
  summary: I18nMessage;
}

export type WatchPlanType = 'LONG' | 'WAIT' | 'AVOID';

export interface WatchlistTradePlan {
  plan_type: WatchPlanType;
  entry_low?: number;
  entry_high?: number;
  stop_loss?: number;
  take_profit_1?: number;
  take_profit_2?: number;
  rr_to_tp1?: number;
  rr_to_tp2?: number;
  summary: I18nMessage;
}

export interface WatchlistItem {
  symbol: string;
  name?: string;
  sector?: string;
  industry?: string;
  price?: number;
  market_cap?: number;
  forward_pe?: number;
  trailing_pe?: number;
  peg_ratio?: number;
  price_to_fcf?: number;
  revenue_growth?: number;
  eps_growth?: number;
  free_cash_flow?: number;
  roic?: number;
  roe?: number;
  updated_at?: string;
  added_at: string;
  note?: string;
  signal: WatchlistSignal;
  technical: WatchlistTechnical;
  quality: WatchlistQualityProfile;
  value_trap: WatchlistValueTrapRisk;
  cycle_profile: WatchlistCycleProfile;
  timing: WatchlistTimingSignal;
  valuation: WatchlistValuation;
  trade_plan: WatchlistTradePlan;
  // Runtime-computed industry valuation score
  valuation_score?: number;
  valuation_label?: string;
  valuation_low_confidence?: boolean;
}

export interface WatchlistResponse {
  total: number;
  items: WatchlistItem[];
}
