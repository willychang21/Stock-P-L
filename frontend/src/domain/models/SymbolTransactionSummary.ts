import Decimal from 'decimal.js';
import { Transaction, TransactionType } from './Transaction';

/**
 * A transaction enriched with realized P/L information
 * Used for displaying transaction history with gains/losses
 */
export interface TransactionWithPL {
  transaction: Transaction;
  realized_pl: Decimal | null; // null for BUY, value for SELL
  return_percentage: Decimal | null; // (realized_pl / cost_basis) * 100, null for BUY
  cost_basis: Decimal | null; // Cost basis of shares sold, null for BUY
}

/**
 * Summary of all transactions for a symbol
 */
export interface SymbolTransactionSummary {
  symbol: string;
  transactions: TransactionWithPL[];
  total_realized_pl: Decimal;
  total_buy_count: number;
  total_sell_count: number;
}

/**
 * Check if a transaction has realized P/L (i.e., is a SELL)
 */
export function hasRealizedPL(txWithPL: TransactionWithPL): boolean {
  return (
    txWithPL.transaction.type === TransactionType.SELL &&
    txWithPL.realized_pl !== null
  );
}
