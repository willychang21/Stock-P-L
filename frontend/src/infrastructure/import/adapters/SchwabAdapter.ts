import { BrokerAdapter, adapterRegistry } from './BrokerAdapter';
import {
  RawTransaction,
  Broker,
  TransactionType,
} from '@domain/models/Transaction';
import Decimal from 'decimal.js';

/**
 * Charles Schwab CSV Adapter
 *
 * Expected columns:
 * - Date
 * - Action (Buy, Sell, Dividend, etc.)
 * - Symbol
 * - Description
 * - Quantity
 * - Price
 * - Fees & Comm (fees and commissions)
 * - Amount (total)
 */
export class SchwabAdapter implements BrokerAdapter {
  readonly broker = Broker.CHARLES_SCHWAB;

  canHandle(headers: string[]): boolean {
    // Schwab-specific column pattern
    const requiredColumns = ['Date', 'Action', 'Symbol'];
    return requiredColumns.every(col =>
      headers.some(h => h.toLowerCase() === col.toLowerCase())
    );
  }

  parseRow(row: Record<string, string>): RawTransaction | null {
    let symbol = this.getSymbol(row);
    const action = (row['Action'] || '').toUpperCase();

    // Skip rows without symbols (Journal, Bank Interest, etc.)
    if (!symbol) {
      return null;
    }

    // Skip non-position actions
    // Skip non-significant actions, but KEEP Cash-related actions
    // Schwab Actions: "Bank Interest", "Journal", "Wire Transfer", "ACH", "Transfer"
    // Actions that might have empty symbol but should be tracked as Cash
    const isCashAction = [
      'JOURNAL',
      'BANK INTEREST',
      'WIRE',
      'TRANSFER',
      'ACH',
      'DEPOSIT',
      'WITHDRAWAL',
    ].some(a => action.includes(a));

    if (isCashAction && !symbol) {
      symbol = 'USD';
    }

    if (!symbol) {
      return null;
    }

    // Skip strictly header/footer junk or actually irrelevant rows logic if needed
    // But now we allow Journal/Cash so we removed the previous skip block.

    const transactionType = this.getTransactionType(row);
    const transactionDate = this.parseDate(row['Date']);

    // Schwab may have separate settle date column
    const settleDate = this.parseDate(
      row['Settle Date'] || row['Settlement Date']
    );

    const quantityRaw = this.getValue(row, ['Quantity']) || '0';
    const quantity = quantityRaw.replace(/,/g, ''); // Handle thousands separator
    const amount = this.parsePrice(this.getValue(row, ['Amount']));
    let price = this.parsePrice(this.getValue(row, ['Price']));
    const fees = this.parseFees(row);

    // For dividends, if price is missing/0 but we have amount, use amount as price
    // This allows createTransaction to calculate total (via special handling or if Q=0 logic is updated)
    // However, since createTransaction does Q*P, we need to be careful.
    // If we change createTransaction to use Price as Total for Dividends where Q=0, this works.
    // For cash-only transactions (Div, Interest, Transfer, Fee) where Price/Qty might be empty,
    // use 'Amount' as the 'Price' (value) of the transaction.
    if (
      transactionType === TransactionType.DIVIDEND ||
      transactionType === TransactionType.INTEREST ||
      transactionType === TransactionType.TRANSFER ||
      transactionType === TransactionType.FEE
    ) {
      if (
        (new Decimal(quantity).isZero() || quantityRaw === '') &&
        (new Decimal(price).isZero() || row['Price'] === undefined) &&
        !new Decimal(amount).isZero()
      ) {
        // For FEE, we usually expect a positive magnitude if the calculator subtracts it.
        // But for TRANSFER/INTEREST, we expect signed values (if calculator adds them).
        // User spec: Journal (Transfer) has signed Amount.
        // Calculator Transfer logic: Adds txAmount. -> Preserves sign.
        // Calculator Fee logic: Subtracts txAmount. -> Needs positive magnitude.

        if (transactionType === TransactionType.FEE) {
          price = Math.abs(parseFloat(amount)).toString();
        } else {
          price = amount;
        }
      }
    }

    return {
      symbol,
      transaction_type: transactionType,
      transaction_date: transactionDate,
      settle_date: settleDate,
      quantity,
      price,
      fees,
      broker: this.broker,
      raw_data: JSON.stringify(row),
    };
  }

  /**
   * Helper to find value in row case-insensitively
   */
  private getValue(
    row: Record<string, string>,
    keys: string[]
  ): string | undefined {
    const rowKeys = Object.keys(row);
    for (const key of keys) {
      if (row[key] !== undefined) return row[key];
      const foundKey = rowKeys.find(
        k => k.toLowerCase().trim() === key.toLowerCase().trim()
      );
      if (foundKey && row[foundKey] !== undefined) return row[foundKey];
    }
    return undefined;
  }

  private getSymbol(row: Record<string, string>): string {
    return (this.getValue(row, ['Symbol', 'Ticker', 'Instrument']) || '')
      .toUpperCase()
      .trim();
  }

  private getTransactionType(row: Record<string, string>): TransactionType {
    const action = (this.getValue(row, ['Action']) || '').toUpperCase();

    // BUY actions
    if (
      action.includes('BUY') ||
      action.includes('BOUGHT') ||
      action.includes('REINVEST SHARES')
    ) {
      return TransactionType.BUY;
    }
    // TRANSFER actions (In/Out)
    if (
      action.includes('JOURNAL') ||
      action.includes('WIRE') ||
      action.includes('ACH') ||
      action.includes('TRANSFER') ||
      action.includes('DEPOSIT') ||
      action.includes('WITHDRAWAL')
    ) {
      return TransactionType.TRANSFER;
    }
    // INTEREST
    if (action.includes('INTEREST')) {
      return TransactionType.INTEREST;
    }
    // SELL actions
    if (action.includes('SELL') || action.includes('SOLD')) {
      return TransactionType.SELL;
    }
    // DIVIDEND actions
    if (action.includes('DIVIDEND') || action.includes('DIV')) {
      return TransactionType.DIVIDEND;
    }
    // FEE actions
    if (action.includes('FEE') || action.includes('COMMISSION')) {
      return TransactionType.FEE;
    }

    // Default to buy for unknown position-related actions
    return TransactionType.BUY;
  }

  private parsePrice(value: string | undefined): string {
    if (!value) return '0';
    let clean = value.trim();
    const isNegative =
      clean.startsWith('-') || (clean.startsWith('(') && clean.endsWith(')'));

    // Remove $, quotes, commas, parentheses, leading dashes
    clean = clean.replace(/[$",()\-\+]/g, '').trim();

    if (isNegative) {
      return '-' + clean;
    }
    return clean || '0';
  }

  private parseFees(row: Record<string, string>): string {
    // Schwab often has "Fees & Comm" column
    const feesComm =
      this.getValue(row, ['Fees & Comm', 'Fees', 'Commission']) || '0';

    // Remove $ and commas
    const cleaned = feesComm.replace(/[$,]/g, '');

    // Handle negative values (fees are positive)
    return Math.abs(parseFloat(cleaned) || 0).toString();
  }

  private parseDate(dateStr: string | undefined): string {
    if (!dateStr) return '';

    // Handle "MM/DD/YYYY as of MM/DD/YYYY" format - use the first date
    let cleanedDate = dateStr.trim();
    if (cleanedDate.toLowerCase().includes(' as of ')) {
      cleanedDate = cleanedDate.split(' as of ')[0] || cleanedDate;
    }

    // Try parsing MM/DD/YYYY format manually for reliability
    const parts = cleanedDate.split('/');
    if (parts.length === 3) {
      const month = parts[0] || '1';
      const day = parts[1] || '1';
      const year = parts[2] || '2000';
      const dateObj = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day)
      );
      if (!isNaN(dateObj.getTime())) {
        return dateObj.toISOString();
      }
    }

    // Fallback to standard parsing
    const date = new Date(cleanedDate);
    if (isNaN(date.getTime())) {
      return '';
    }

    return date.toISOString();
  }
}

// Auto-register
adapterRegistry.register(new SchwabAdapter());
