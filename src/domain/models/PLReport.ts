import Decimal from 'decimal.js';
import { Lot } from './Holding';

/**
 * Cost basis calculation method
 */
export type CostBasisMethod = 'FIFO' | 'AVERAGE_COST';

/**
 * Result of processing a single transaction through P/L calculator
 */
export interface PLResult {
  realized_pl: Decimal; // P/L realized by this transaction (0 for BUY)
  matched_lots?: LotMatch[]; // For SELL: which lots were consumed (audit trail)
}

/**
 * Record of a lot matched during a SELL transaction
 * Used for audit trail and tax reporting
 */
export interface LotMatch {
  lot: Lot; // The original lot
  quantity_sold: Decimal; // How many shares from this lot were sold
  pl: Decimal; // P/L from this specific lot match
  purchase_date: string; // Convenience field for reporting
  sale_date: string; // Date of the SELL transaction
}

/**
 * Per-symbol P/L breakdown
 */
export interface SymbolPL {
  symbol: string;
  realized_pl: Decimal;
  unrealized_pl: Decimal;
  total_pl: Decimal;
  total_invested: Decimal; // Total cost basis
  current_value: Decimal; // Current market value
  return_percentage: Decimal; // (total_pl / total_invested) * 100
}

/**
 * Comprehensive P/L report for a time range
 */
export interface PLReport {
  start_date: string;
  end_date: string;
  cost_basis_method: CostBasisMethod;

  // Aggregate metrics
  realized_pl: Decimal; // Sum of closed position gains/losses
  unrealized_pl: Decimal; // Current open positions
  total_pl: Decimal; // realized + unrealized

  // Per-symbol breakdown
  breakdown_by_symbol: Map<string, SymbolPL>;

  // Metadata
  transactions_analyzed: number;
  symbols_count: number;
}

/**
 * Create an empty P/L report
 */
export function createEmptyPLReport(
  startDate: string,
  endDate: string,
  method: CostBasisMethod
): PLReport {
  return {
    start_date: startDate,
    end_date: endDate,
    cost_basis_method: method,
    realized_pl: new Decimal(0),
    unrealized_pl: new Decimal(0),
    total_pl: new Decimal(0),
    breakdown_by_symbol: new Map(),
    transactions_analyzed: 0,
    symbols_count: 0,
  };
}

/**
 * Add symbol P/L to the report
 */
export function addSymbolToReport(
  report: PLReport,
  symbolPL: SymbolPL
): PLReport {
  const breakdown = new Map(report.breakdown_by_symbol);
  breakdown.set(symbolPL.symbol, symbolPL);

  return {
    ...report,
    realized_pl: report.realized_pl.plus(symbolPL.realized_pl),
    unrealized_pl: report.unrealized_pl.plus(symbolPL.unrealized_pl),
    total_pl: report.total_pl.plus(symbolPL.total_pl),
    breakdown_by_symbol: breakdown,
    symbols_count: breakdown.size,
  };
}
