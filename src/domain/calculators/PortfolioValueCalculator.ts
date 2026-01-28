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
  transferCashFlow: Decimal; // Only TRANSFER transactions (deposits/withdrawals)
  costBasis: Decimal;
  realizedPL: Decimal;
  cashBalance: Decimal;
}

export class PortfolioValueCalculator {
  /**
   * Get all unique dates where transactions occurred, sorted ascending.
   */
  private getTransactionDates(transactions: Transaction[]): string[] {
    const dates = new Set<string>();
    for (const tx of transactions) {
      dates.add(tx.date.toISOString().split('T')[0]!);
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
    const allTransactions = await transactionRepo.findAll();

    if (allTransactions.length === 0) return [];

    // Sort by date then ID
    allTransactions.sort(
      (a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id)
    );

    const firstTx = allTransactions[0];
    if (!firstTx) return [];

    const startDate: string = firstTx.date.toISOString().split('T')[0]!;
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

    let currentCashBalance = new Decimal(0);
    let txIndex = 0;
    const dailyValues: DailyPortfolioValue[] = [];
    const transactionDates = this.getTransactionDates(allTransactions);

    // We strictly use transaction dates for the graph points
    for (const date of transactionDates) {
      // Calculate daily cash flow for this specific date
      let dailyCashFlow = new Decimal(0);
      let dailyTransferCashFlow = new Decimal(0); // Only TRANSFER transactions

      // Process all transactions up to/on this date
      while (
        txIndex < allTransactions.length &&
        allTransactions[txIndex]!.date.toISOString().split('T')[0]! <= date
      ) {
        const tx = allTransactions[txIndex]!;
        const sym = tx.symbol.toUpperCase();

        // Skip calculator processing for pure cash transactions (USD)
        // But we MUST process them for Cash Balance
        const isCashOnly = sym === 'USD';

        // --- 1. Update Cash Balance ---
        // Exception: For Transfers/Interest/Divs, 'price' might be the full amount if quantity is 0 or 1.
        // Let's rely on a helper or the logic used in adapters.
        // Adapters put total amount in 'price' if quantity is 0 for Div/Interest.
        // Standardize amount calculation (Respect Sign for Transfers):
        let txAmount = new Decimal(0);
        if (tx.quantity.isZero() && !tx.price.isZero()) {
          txAmount = tx.price;
        } else {
          txAmount = tx.quantity.times(tx.price);
        }

        // Adjust for valid cash flows
        switch (tx.type) {
          case TransactionType.BUY:
            // Buying stock reduces cash (Cost + Fees)
            // Cost = Q * P. Total outflow = Cost + Fees.
            // Note: 'tx.price' is usually share price.
            currentCashBalance = currentCashBalance
              .minus(tx.quantity.times(tx.price))
              .minus(tx.fees);
            dailyCashFlow = dailyCashFlow.plus(
              tx.quantity.times(tx.price).plus(tx.fees)
            ); // Net Invested increases
            break;
          case TransactionType.SELL:
            // Selling stock increases cash (Revenue - Fees)
            currentCashBalance = currentCashBalance
              .plus(tx.quantity.times(tx.price))
              .minus(tx.fees);
            dailyCashFlow = dailyCashFlow.minus(
              tx.quantity.times(tx.price).minus(tx.fees)
            ); // Net Invested decreases
            break;
          case TransactionType.DIVIDEND:
          case TransactionType.INTEREST:
            // Cash Inflow
            currentCashBalance = currentCashBalance.plus(txAmount);
            // Dividends/Interest are usually NOT considered "Net Invested" capital contributions from user,
            // but internal portfolio growth. So dailyCashFlow (Net Invested) remains 0.
            break;
          case TransactionType.FEE:
            // Cash Outflow
            currentCashBalance = currentCashBalance.minus(txAmount);
            break;
          case TransactionType.TRANSFER:
            // Deposit or Withdrawal
            // Use signed amount directly
            currentCashBalance = currentCashBalance.plus(txAmount);
            dailyCashFlow = dailyCashFlow.plus(txAmount);
            dailyTransferCashFlow = dailyTransferCashFlow.plus(txAmount); // Track transfers separately
            break;
        }

        // --- 2. Process Symmbol Logic (Holdings) ---
        if (!isCashOnly) {
          const calculator = getCalculator(sym);
          try {
            calculator.processTransaction(tx);
          } catch (e) {
            console.warn(`⚠️ Error processing transaction for ${sym}:`, e);
          }
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

      // Add Cash to Market Value for Total Account Value ?
      // Usually "Portfolio Value" = Market Value of Securities + Cash.
      // Let's add it.
      marketValue = marketValue.plus(currentCashBalance);

      dailyValues.push({
        date,
        marketValue, // Now includes Cash
        cashFlow: dailyCashFlow,
        transferCashFlow: dailyTransferCashFlow, // Only deposits/withdrawals
        costBasis: totalCostBasis,
        realizedPL: cumulativeRealizedPL,
        cashBalance: currentCashBalance,
      });
    }

    return dailyValues;
  }

  /**
   * Get the first transaction date in the portfolio.
   */
  async getFirstTransactionDate(): Promise<string | null> {
    const allSymbols = await transactionRepo.getAllSymbols();
    let earliestDate: Date | null = null;

    for (const symbol of allSymbols) {
      const txs = await transactionRepo.findBySymbol(symbol);
      for (const tx of txs) {
        if (!earliestDate || tx.date < earliestDate) {
          earliestDate = tx.date;
        }
      }
    }

    return earliestDate ? earliestDate.toISOString().split('T')[0]! : null;
  }
}

export const portfolioValueCalculator = new PortfolioValueCalculator();
