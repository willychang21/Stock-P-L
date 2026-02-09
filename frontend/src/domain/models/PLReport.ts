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
  realized_pl: Decimal; // Keeping snake_case for internal calculator logic if needed, or unify?
  // Let's unify to camelCase
  realizedPL: Decimal; 
  matchedLots?: LotMatch[]; 
}

/**
 * Record of a lot matched during a SELL transaction
 * Used for audit trail and tax reporting
 */
export interface LotMatch {
  lot: Lot; 
  quantitySold: Decimal; 
  pl: Decimal; 
  purchaseDate: string; 
  saleDate: string; 
}

/**
 * Per-symbol P/L breakdown
 */
export interface SymbolPL {
  symbol: string;
  realizedPL: Decimal;
  unrealizedPL: Decimal;
  totalPL: Decimal;
  totalInvested: Decimal; 
  currentValue: Decimal; 
  returnPercentage: Decimal; 
}

/**
 * Comprehensive P/L report for a time range
 */
export interface PLReport {
  startDate: string;
  endDate: string;
  costBasisMethod: CostBasisMethod;

  // Aggregate metrics
  realizedPL: Decimal; 
  unrealizedPL: Decimal; 
  totalPL: Decimal; 

  // Per-symbol breakdown
  breakdownBySymbol: Map<string, SymbolPL>;

  // Metadata
  transactionsAnalyzed: number;
  symbolsCount: number;
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
    startDate,
    endDate,
    costBasisMethod: method,
    realizedPL: new Decimal(0),
    unrealizedPL: new Decimal(0),
    totalPL: new Decimal(0),
    breakdownBySymbol: new Map(),
    transactionsAnalyzed: 0,
    symbolsCount: 0,
  };
}

/**
 * Add symbol P/L to the report
 */
export function addSymbolToReport(
  report: PLReport,
  symbolPL: SymbolPL
): PLReport {
  const breakdown = new Map(report.breakdownBySymbol);
  breakdown.set(symbolPL.symbol, symbolPL);

  return {
    ...report,
    realizedPL: report.realizedPL.plus(symbolPL.realizedPL),
    unrealizedPL: report.unrealizedPL.plus(symbolPL.unrealizedPL),
    totalPL: report.totalPL.plus(symbolPL.totalPL),
    breakdownBySymbol: breakdown,
    symbolsCount: breakdown.size,
  };
}