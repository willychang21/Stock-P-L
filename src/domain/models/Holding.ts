import Decimal from 'decimal.js';

/**
 * A lot represents a specific purchase of shares with its own cost basis
 * Used in FIFO (First-In-First-Out) cost basis calculation
 */
export interface Lot {
  purchase_date: string; // ISO 8601 date of original purchase
  quantity: Decimal; // Remaining shares in this lot
  cost_basis_per_share: Decimal; // Purchase price + allocated fees
  transaction_id: string; // Link to original BUY transaction
}

/**
 * Current holding for a symbol, derived from transaction history
 * This is NOT persisted - always computed on demand
 */
export interface Holding {
  symbol: string;
  assetType: string;
  total_shares: Decimal; // Current position (sum of all transaction quantities)
  average_cost: Decimal; // For Average Cost method
  lots: Lot[]; // For FIFO method (chronologically ordered)
  market_value: Decimal; // total_shares * current_price
  current_price: Decimal; // Latest known price (manual input or API)
  unrealized_pl: Decimal; // market_value - cost_basis
  cost_basis: Decimal; // Total cost basis
  return_percentage?: Decimal; // (unrealized_pl / cost_basis) * 100
}

/**
 * Helper to create an empty holding
 */
export function createEmptyHolding(symbol: string): Holding {
  return {
    symbol,
    assetType: 'UNKNOWN',
    total_shares: new Decimal(0),
    average_cost: new Decimal(0),
    lots: [],
    market_value: new Decimal(0),
    current_price: new Decimal(0),
    unrealized_pl: new Decimal(0),
    cost_basis: new Decimal(0),
  };
}

/**
 * Calculate market value and unrealized P/L for a holding
 */
export function updateHoldingPrices(
  holding: Holding,
  currentPrice: Decimal
): Holding {
  const market_value = holding.total_shares.times(currentPrice);
  const unrealized_pl = market_value.minus(holding.cost_basis);

  return {
    ...holding,
    current_price: currentPrice,
    market_value,
    unrealized_pl,
  };
}

/**
 * Serializable lot for storage
 */
export interface SerializedLot {
  purchase_date: string;
  quantity: string;
  cost_basis_per_share: string;
  transaction_id: string;
}

/**
 * Convert Lot to serializable format
 */
export function serializeLot(lot: Lot): SerializedLot {
  return {
    purchase_date: lot.purchase_date,
    quantity: lot.quantity.toString(),
    cost_basis_per_share: lot.cost_basis_per_share.toString(),
    transaction_id: lot.transaction_id,
  };
}

/**
 * Convert serialized lot back to Lot with Decimal types
 */
export function deserializeLot(serialized: SerializedLot): Lot {
  return {
    purchase_date: serialized.purchase_date,
    quantity: new Decimal(serialized.quantity),
    cost_basis_per_share: new Decimal(serialized.cost_basis_per_share),
    transaction_id: serialized.transaction_id,
  };
}
/**
 * Deserialize holding from plain object (e.g. from JSON)
 */
export function deserializeHolding(data: any): Holding {
  return {
    ...data,
    total_shares: new Decimal(data.total_shares || 0),
    average_cost: new Decimal(data.average_cost || 0),
    lots: (data.lots || []).map((l: any) => ({
      ...l,
      quantity: new Decimal(l.quantity || 0),
      cost_basis_per_share: new Decimal(l.cost_basis_per_share || 0),
    })),
    market_value: new Decimal(data.market_value || 0),
    current_price: new Decimal(data.current_price || 0),
    unrealized_pl: new Decimal(data.unrealized_pl || 0),
    cost_basis: new Decimal(data.cost_basis || 0),
    return_percentage: data.return_percentage ? new Decimal(data.return_percentage) : undefined,
  };
}
