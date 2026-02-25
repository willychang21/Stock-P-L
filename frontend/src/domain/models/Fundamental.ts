export interface Fundamental {
  symbol: string;
  sector?: string;
  industry?: string;
  marketCap?: number;
  trailingPE?: number;
  forwardPE?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  dividendYield?: number;
  beta?: number;
  trailingEps?: number;
  forwardEps?: number;
  profitMargins?: number;
  returnOnEquity?: number;
  returnOnAssets?: number;
  revenueGrowth?: number;
  debtToEquity?: number;
  exDividendDate?: number;
  payoutRatio?: number;
  earningsDate?: number | null;
}
