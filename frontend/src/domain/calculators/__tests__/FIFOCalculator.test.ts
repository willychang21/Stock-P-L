import { describe, it, expect } from 'vitest';
import { FIFOCalculator } from '../FIFOCalculator';
import { TransactionType } from '../../models/Transaction';
import Decimal from 'decimal.js';

describe('FIFOCalculator', () => {
  const calc = new FIFOCalculator();

  it('should calculate FIFO correctly for simple buy and sell', () => {
    const transactions = [
      { id: '1', date: new Date('2023-01-01'), symbol: 'AAPL', type: TransactionType.BUY, quantity: new Decimal(10), price: new Decimal(100), fees: new Decimal(10), currency: 'USD' },
      { id: '2', date: new Date('2023-01-02'), symbol: 'AAPL', type: TransactionType.SELL, quantity: new Decimal(5), price: new Decimal(150), fees: new Decimal(5), currency: 'USD' },
    ];

    const result = calc.calculate(transactions as any, {});
    
    // Cost basis: (100 * 10 + 10) / 10 = 101 per share
    // Sell 5 shares. Cost basis of 5 shares = 505.
    // Proceeds: 5 * 150 - 5 = 745.
    // Realized P/L = 745 - 505 = 240.
    expect(result.metrics.totalRealizedPL.toNumber()).toBe(240);
    expect(result.metrics.holdings.toNumber()).toBe(5);
    expect(result.metrics.costBasis.toNumber()).toBe(505);
  });
});
