import Decimal from 'decimal.js';

export interface Lot {
  id: string;
  purchase_date: string;
  quantity: Decimal;
  price: Decimal;
  fees: Decimal;
  cost_basis_per_share: Decimal;
}

export interface FundamentalData {
  sector?: string;
  industry?: string;
  marketCap?: number;
  peRatio?: number;
  forwardPE?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  dividendYield?: number;
  beta?: number;
}

export interface Holding {
  symbol: string;
  quantity: Decimal;
  averageCost: Decimal;
  currentPrice: Decimal;
  marketValue: Decimal;
  unrealizedPL: Decimal;
  realizedPL: Decimal;
  assetType?: string;
  costBasis: Decimal;
  fundamentals?: FundamentalData;
  note?: string;
  // Legacy support
  total_shares: Decimal;
  average_cost: Decimal;
  cost_basis: Decimal;
  current_price: Decimal;
  market_value: Decimal;
  unrealized_pl: Decimal;
  lots: Lot[];
}

export function createEmptyHolding(symbol: string): Holding {
  return {
    symbol,
    quantity: new Decimal(0),
    averageCost: new Decimal(0),
    currentPrice: new Decimal(0),
    marketValue: new Decimal(0),
    unrealizedPL: new Decimal(0),
    realizedPL: new Decimal(0),
    costBasis: new Decimal(0),
    assetType: 'UNKNOWN',
    // Legacy support
    total_shares: new Decimal(0),
    average_cost: new Decimal(0),
    cost_basis: new Decimal(0),
    current_price: new Decimal(0),
    market_value: new Decimal(0),
    unrealized_pl: new Decimal(0),
    lots: [],
  };
}
