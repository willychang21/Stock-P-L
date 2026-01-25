import Decimal from 'decimal.js';

export enum TransactionType {
  BUY = 'BUY',
  SELL = 'SELL',
  DIVIDEND = 'DIVIDEND',
  SPLIT = 'SPLIT',
  FEE = 'FEE',
  TRANSFER = 'TRANSFER',
  INTEREST = 'INTEREST',
}

export enum Broker {
  ROBINHOOD = 'ROBINHOOD',
  SCHWAB = 'SCHWAB',
  CHARLES_SCHWAB = 'CHARLES_SCHWAB',
  GENERIC = 'GENERIC',
  MANUAL = 'MANUAL',
}

export interface Transaction {
  id: string; // UUID
  date: Date;
  symbol: string;
  type: TransactionType;
  quantity: Decimal;
  price: Decimal;
  fees: Decimal;
  currency: string;
  broker?: string;
  rawData?: string;
  notes?: string;
  tags?: string[];
  rating?: number;
}

export interface RawTransaction {
  symbol: string;
  transaction_type: TransactionType;
  transaction_date: string;
  settle_date?: string;
  quantity: string;
  price: string;
  fees: string;
  broker: Broker;
  raw_data: string;
  notes?: string;
}

export function createTransaction(
  raw: RawTransaction,
  _batchId?: string
): Transaction {
  return {
    id: crypto.randomUUID(),
    date: new Date(raw.transaction_date),
    symbol: raw.symbol,
    type: raw.transaction_type,
    quantity: new Decimal(raw.quantity),
    price: new Decimal(raw.price),
    fees: new Decimal(raw.fees),
    currency: 'USD',
    broker: raw.broker,
    rawData: raw.raw_data,
    notes: raw.notes,
  };
}
