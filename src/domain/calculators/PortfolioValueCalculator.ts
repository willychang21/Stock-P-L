/**
 * Portfolio Value Calculator
 * Calculates daily portfolio market value based on holdings and historical prices.
 */

import Decimal from 'decimal.js';
import { transactionRepo } from '@infrastructure/storage/TransactionRepository';
import { historicalPriceService } from '@application/services/HistoricalPriceService';
import { Transaction, TransactionType } from '@domain/models/Transaction';
import { FIFOCalculator } from '@domain/calculators/FIFOCalculator';

export interface DailyPortfolioValue {
  date: string;
  marketValue: Decimal;
  cashFlow: Decimal;
  costBasis: Decimal;
  realizedPL: Decimal;
}

export class PortfolioValueCalculator {
  /**
   * Get all unique dates where transactions occurred, sorted ascending.
   */
  private getTransactionDates(transactions: Transaction[]): string[] {
    const dates = new Set<string>();
    for (const tx of transactions) {
      dates.add(tx.transaction_date);
    }
    return Array.from(dates).sort();
  }

  /**
   * Get all unique symbols from transactions.
   */
  private getSymbols(transactions: Transaction[]): string[] {
    const symbols = new Set<string>();
    for (const tx of transactions) {
      if (tx.symbol) symbols.add(tx.symbol.toUpperCase());
    }
    return Array.from(symbols);
  }

  /**
   * Calculate daily portfolio values including Market Value, Cost Basis, and Realized P/L.
   */
  async calculateDailyValues(endDate?: string): Promise<DailyPortfolioValue[]> {
    // Get all transactions
    const allSymbols = await transactionRepo.getAllSymbols();
    const allTransactions: Transaction[] = [];

    for (const symbol of allSymbols) {
      const txs = await transactionRepo.findBySymbol(symbol);
      allTransactions.push(...txs);
    }

    if (allTransactions.length === 0) return [];

    // Sort by date then ID
    allTransactions.sort(
      (a, b) =>
        a.transaction_date.localeCompare(b.transaction_date) ||
        a.id.localeCompare(b.id)
    );

    const firstTx = allTransactions[0];
    if (!firstTx) return [];

    const startDate: string = firstTx.transaction_date;
    const todayStr = new Date().toISOString().split('T')[0] || startDate;
    const actualEndDate: string = endDate || todayStr;

    // Get historical prices
    const symbols = this.getSymbols(allTransactions);
    const historicalPrices =
      await historicalPriceService.getBatchHistoricalPrices(
        symbols,
        startDate,
        actualEndDate
      );

    // Track portfolio state day by day using FIFOCalculator for each symbol
    const symbolCalculators = new Map<string, FIFOCalculator>();
    const getCalculator = (symbol: string) => {
      if (!symbolCalculators.has(symbol)) {
        symbolCalculators.set(symbol, new FIFOCalculator());
      }
      return symbolCalculators.get(symbol)!;
    };

    let txIndex = 0;
    const dailyValues: DailyPortfolioValue[] = [];
    const transactionDates = this.getTransactionDates(allTransactions);

    // We strictly use transaction dates for the graph points
    for (const date of transactionDates) {
      // Calculate daily cash flow for this specific date
      let dailyCashFlow = new Decimal(0);

      // Process all transactions up to/on this date
      while (
        txIndex < allTransactions.length &&
        allTransactions[txIndex]!.transaction_date <= date
      ) {
        const tx = allTransactions[txIndex]!;
        const sym = tx.symbol.toUpperCase();
        const calculator = getCalculator(sym);

        // Update daily cash flow
        // Standard definition:
        // BUY: Cash OUT of pocket (-), into strategy. But for "Net Invested" tracking, we usually sum INFLOWS as positive.
        // Let's stick to the previous BenchmarkService logic:
        // "Net Invested" = Sum of CashFlows.
        // Buy = Positive Investment.
        // Sell = Negative Investment (Capital Returned).
        const amount = tx.total_amount.abs();

        if (tx.transaction_type === TransactionType.BUY) {
          dailyCashFlow = dailyCashFlow.plus(amount);
        } else if (tx.transaction_type === TransactionType.SELL) {
          dailyCashFlow = dailyCashFlow.minus(amount);
        }

        // Process transaction in calculator
        // This updates the internal lots and realized P/L
        try {
          calculator.processTransaction(tx);
        } catch (e) {
          console.warn(`⚠️ Error processing transaction for ${sym}:`, e);
        }

        txIndex++;
      }

      // Snapshot for this date
      let marketValue = new Decimal(0);
      let totalCostBasis = new Decimal(0);
      let cumulativeRealizedPL = new Decimal(0);

      // Calculate aggregated metrics from all symbol calculators
      for (const [sym, calculator] of symbolCalculators.entries()) {
        const quantity = calculator.getTotalShares();

        // Accumulate specific metrics from FIFO logic
        totalCostBasis = totalCostBasis.plus(calculator.getTotalCostBasis());
        cumulativeRealizedPL = cumulativeRealizedPL.plus(
          calculator.getTotalRealizedPL()
        );

        if (quantity.isZero()) continue;

        // Get price for Market Value
        const prices = historicalPrices.get(sym) || [];
        let price = 0;
        // Find latest price on/before date
        for (let i = prices.length - 1; i >= 0; i--) {
          const p = prices[i];
          if (p && p.date <= date) {
            price = p.close;
            break;
          }
        }
        // Fallback to first price if no price found before date
        const firstPrice = prices[0];
        if (price === 0 && firstPrice) price = firstPrice.close;

        marketValue = marketValue.plus(quantity.times(price));
      }

      dailyValues.push({
        date,
        marketValue,
        cashFlow: dailyCashFlow,
        costBasis: totalCostBasis,
        realizedPL: cumulativeRealizedPL,
      });
    }

    return dailyValues;
  }

  /**
   * Get the first transaction date in the portfolio.
   */
  async getFirstTransactionDate(): Promise<string | null> {
    const allSymbols = await transactionRepo.getAllSymbols();
    let earliest: string | null = null;

    for (const symbol of allSymbols) {
      const txs = await transactionRepo.findBySymbol(symbol);
      for (const tx of txs) {
        if (!earliest || tx.transaction_date < earliest) {
          earliest = tx.transaction_date;
        }
      }
    }

    return earliest;
  }
}

export const portfolioValueCalculator = new PortfolioValueCalculator();
