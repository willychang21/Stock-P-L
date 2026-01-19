import {
  BrokerAdapter,
  adapterRegistry,
} from './BrokerAdapter';
import { RawTransaction, Broker, TransactionType } from '@domain/models/Transaction';

/**
 * Robinhood CSV Adapter
 * 
 * Expected columns:
 * - Activity Date
 * - Process Date (settlement)
 * - Settle Date
 * - Instrument (symbol)
 * - Description
 * - Trans Code (Buy, Sell, CDIV, INT, etc.)
 * - Quantity
 * - Price
 * - Amount (total)
 */
export class RobinhoodAdapter implements BrokerAdapter {
  readonly broker = Broker.ROBINHOOD;

  canHandle(headers: string[]): boolean {
    // Robinhood-specific column names
    const requiredColumns = ['Activity Date', 'Instrument', 'Trans Code'];
    return requiredColumns.every((col) =>
      headers.some((h) => h.toLowerCase().trim() === col.toLowerCase())
    );
  }

  parseRow(row: Record<string, string>): RawTransaction | null {
    const symbol = this.getSymbol(row);
    // Skip empty rows or summary lines
    if (!symbol && !this.getValue(row, ['Activity Date', 'Date'])) {
       return null;
    }

    // Skip non-position transactions (interest, fees, deposits, etc.)
    if (!symbol || symbol === '') {
      return null;
    }

    const quantityRaw = this.getValue(row, ['Quantity']) || '0';
    const priceRaw = this.getValue(row, ['Price']) || '0';
    const amountRaw = this.getValue(row, ['Amount']) || '0';

    const quantity = this.parseNumber(quantityRaw);
    const price = this.parsePrice(priceRaw);
    const amount = this.parsePrice(amountRaw);

    const fees = '0';
    
    const transCode = (this.getValue(row, ['Trans Code']) || '').toUpperCase();
    if (transCode === 'CDIV' || transCode === 'INT' || transCode === 'DIV') {
      return {
        symbol,
        transaction_type: TransactionType.DIVIDEND,
        transaction_date: this.parseDate(this.getValue(row, ['Activity Date', 'Date'])),
        settle_date: this.parseDate(this.getValue(row, ['Settle Date'])),
        quantity: '0',
        price: amount, // For dividends, price can be total amount or 0
        fees: '0',
        broker: this.broker,
        raw_data: JSON.stringify(row),
      };
    }

    const transactionType = this.getTransactionType(row);
    const transactionDate = this.parseDate(this.getValue(row, ['Activity Date', 'Date']));
    const settleDate = this.parseDate(this.getValue(row, ['Settle Date']));

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
  private getValue(row: Record<string, string>, keys: string[]): string | undefined {
    const rowKeys = Object.keys(row);
    for (const key of keys) {
      // Try exact match first
      if (row[key] !== undefined) return row[key];
      
      // Try case-insensitive match
      const foundKey = rowKeys.find(k => k.toLowerCase().trim() === key.toLowerCase().trim());
      if (foundKey && row[foundKey] !== undefined) return row[foundKey];
    }
    return undefined;
  }

  private getSymbol(row: Record<string, string>): string {
    const instrument = this.getValue(row, ['Instrument', 'Symbol', 'Ticker']) || '';
    return instrument.trim().toUpperCase();
  }

  private getTransactionType(row: Record<string, string>): TransactionType {
    const transCode = (this.getValue(row, ['Trans Code']) || '').toUpperCase().trim();
    const description = (this.getValue(row, ['Description']) || '').toUpperCase();

    // Check Trans Code first
    if (transCode === 'BUY') return TransactionType.BUY;
    if (transCode === 'SELL') return TransactionType.SELL;
    if (transCode === 'CDIV' || transCode === 'DIV') return TransactionType.DIVIDEND;
    if (transCode === 'INT') return TransactionType.DIVIDEND; // Interest as dividend
    
    // Fallback to description
    if (description.includes('BUY')) {
         console.warn(`RH Adapter inferred BUY from description: "${description}"`);
         return TransactionType.BUY;
    }
    if (description.includes('SELL')) return TransactionType.SELL;
    if (description.includes('DIVIDEND')) return TransactionType.DIVIDEND;

    // Default to error if undetermined - DO NOT default to BUY
    throw new Error(`Unknown transaction type. Code: "${transCode}", Desc: "${description}". Row keys: ${Object.keys(row).join(',')}`);
  }

  private parseDate(dateStr: string | undefined): string {
    if (!dateStr) return '';

    // Robinhood uses M/DD/YYYY format (e.g., "1/14/2026")
    const cleanDate = dateStr.trim();
    
    // Try to parse MM/DD/YYYY format manually
    const parts = cleanDate.split('/');
    if (parts.length === 3) {
      const month = parseInt(parts[0]!, 10);
      const day = parseInt(parts[1]!, 10);
      const year = parseInt(parts[2]!, 10);
      
      if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
        const date = new Date(year, month - 1, day);
        return date.toISOString();
      }
    }

    // Fallback to native Date parsing
    const date = new Date(cleanDate);
    if (isNaN(date.getTime())) {
      return '';
    }
    return date.toISOString();
  }

  private parsePrice(value: string | undefined): string {
    if (!value) return '0';
    // Remove $, commas, quotes, parentheses
    return value.replace(/[$,"\(\)]/g, '').trim() || '0';
  }

  private parseNumber(value: string | undefined): string {
    if (!value) return '0';
    // Remove commas and clean up
    return value.replace(/,/g, '').trim() || '0';
  }
}

// Auto-register
adapterRegistry.register(new RobinhoodAdapter());
