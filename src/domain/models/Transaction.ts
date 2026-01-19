import Decimal from 'decimal.js';

/**
 * Transaction types supported by the system
 */
export enum TransactionType {
  BUY = 'BUY',
  SELL = 'SELL',
  DIVIDEND = 'DIVIDEND',
  FEE = 'FEE',
  STOCK_SPLIT = 'STOCK_SPLIT',
}

/**
 * Supported brokers for CSV import
 */
export enum Broker {
  ROBINHOOD = 'ROBINHOOD',
  CHARLES_SCHWAB = 'CHARLES_SCHWAB',
  MANUAL = 'MANUAL',
}

/**
 * Core transaction model - immutable record of a financial transaction
 * This is the single source of truth for all portfolio state
 */
export interface Transaction {
  // Identity
  id: string; // UUID v4
  import_batch_id: string; // Links to CSVImportBatch for auditability

  // Core Transaction Data
  symbol: string; // Normalized ticker (e.g., "AAPL")
  transaction_type: TransactionType;
  transaction_date: string; // ISO 8601 UTC timestamp
  settle_date: string | null; // T+2 settlement (null if not applicable)

  // Quantities - using Decimal for precision
  quantity: Decimal; // Shares (positive for BUY, negative for SELL)
  price: Decimal; // Price per share (USD)
  fees: Decimal; // Commissions + regulatory fees
  total_amount: Decimal; // quantity * price + fees (negative for BUY)

  // Metadata
  broker: Broker;
  account_id?: string; // Optional account identifier
  notes?: string; // User annotations

  // Audit Trail
  created_at: string; // Import timestamp
  raw_data: string; // Original CSV row (JSON-serialized)
}

/**
 * Raw transaction data from CSV before normalization
 */
export interface RawTransaction {
  symbol: string;
  transaction_type: TransactionType;
  transaction_date: string;
  settle_date?: string;
  quantity: string; // String to preserve precision before conversion
  price: string;
  fees?: string;
  broker: Broker;
  account_id?: string;
  notes?: string;
  raw_data: string;
}

/**
 * Type guard to check if a transaction is a BUY
 */
export function isBuyTransaction(tx: Transaction): boolean {
  return tx.transaction_type === TransactionType.BUY;
}

/**
 * Type guard to check if a transaction is a SELL
 */
export function isSellTransaction(tx: Transaction): boolean {
  return tx.transaction_type === TransactionType.SELL;
}

/**
 * Type guard to check if a transaction affects position (BUY or SELL)
 */
export function isPositionTransaction(tx: Transaction): boolean {
  return (
    tx.transaction_type === TransactionType.BUY ||
    tx.transaction_type === TransactionType.SELL
  );
}

/**
 * Helper to create a normalized Transaction from raw CSV data
 */
export function createTransaction(
  raw: RawTransaction,
  importBatchId: string
): Transaction {
  const id = crypto.randomUUID();
  const quantity = new Decimal(raw.quantity);
  const price = new Decimal(raw.price);
  const fees = new Decimal(raw.fees || '0');

  // For SELL transactions, quantity should be negative
  const normalizedQuantity =
    raw.transaction_type === TransactionType.SELL
      ? quantity.neg()
      : quantity;

  // Total amount: for BUY it's negative (cash out), for SELL it's positive (cash in)
  let totalAmount = normalizedQuantity.times(price).minus(fees);

  // Special handling for DIVIDENDs where quantity is 0 (Cash Dividend)
  // Adapters put the total dividend amount into the 'price' field for these cases
  if (raw.transaction_type === TransactionType.DIVIDEND && normalizedQuantity.isZero()) {
    totalAmount = price.minus(fees);
  }

  return {
    id,
    import_batch_id: importBatchId,
    symbol: raw.symbol.toUpperCase().trim(),
    transaction_type: raw.transaction_type,
    transaction_date: raw.transaction_date,
    settle_date: raw.settle_date || null,
    quantity: normalizedQuantity,
    price,
    fees,
    total_amount: totalAmount,
    broker: raw.broker,
    account_id: raw.account_id,
    notes: raw.notes,
    created_at: new Date().toISOString(),
    raw_data: raw.raw_data,
  };
}

/**
 * Serializable transaction for storage (Decimal converted to string)
 */
export interface SerializedTransaction {
  id: string;
  import_batch_id: string;
  symbol: string;
  transaction_type: TransactionType;
  transaction_date: string;
  settle_date: string | null;
  quantity: string;
  price: string;
  fees: string;
  total_amount: string;
  broker: Broker;
  account_id?: string;
  notes?: string;
  created_at: string;
  raw_data: string;
}

/**
 * Convert Transaction to serializable format for database storage
 */
export function serializeTransaction(tx: Transaction): SerializedTransaction {
  return {
    ...tx,
    quantity: tx.quantity.toString(),
    price: tx.price.toString(),
    fees: tx.fees.toString(),
    total_amount: tx.total_amount.toString(),
  };
}

/**
 * Convert serialized transaction back to Transaction with Decimal types
 */
export function deserializeTransaction(
  serialized: SerializedTransaction
): Transaction {
  return {
    ...serialized,
    quantity: new Decimal(serialized.quantity),
    price: new Decimal(serialized.price),
    fees: new Decimal(serialized.fees),
    total_amount: new Decimal(serialized.total_amount),
  };
}
