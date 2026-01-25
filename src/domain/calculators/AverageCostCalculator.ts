import Decimal from 'decimal.js';
import { Transaction, TransactionType } from '../models/Transaction';
import { PLResult } from '../models/PLReport';

/**
 * Average Cost P/L Calculator
 * 
 * Simpler than FIFO - maintains running average of cost basis.
 * Used for comparison and user preference, but NOT IRS-compliant for stocks.
 */
export class AverageCostCalculator {
  private totalShares: Decimal = new Decimal(0);
  private totalCostBasis: Decimal = new Decimal(0);
  private totalRealizedPL: Decimal = new Decimal(0);

  /**
   * Process a single transaction and update internal state
   * @param tx Transaction to process
   * @returns PLResult with realized P/L
   * @throws Error if attempting to oversell
   */
  processTransaction(tx: Transaction): PLResult {
    if (tx.type === TransactionType.BUY) {
      return this.processBuy(tx);
    } else if (tx.type === TransactionType.SELL) {
      return this.processSell(tx);
    } else {
      // DIVIDEND, FEE, etc. don't affect position
      return { realizedPL: new Decimal(0), realized_pl: new Decimal(0) };
    }
  }

  /**
   * Get the current total realized P/L
   */
  getTotalRealizedPL(): Decimal {
    return this.totalRealizedPL;
  }

  /**
   * Get the current average cost per share
   */
  getAverageCost(): Decimal {
    if (this.totalShares.isZero()) {
      return new Decimal(0);
    }
    return this.totalCostBasis.div(this.totalShares);
  }

  /**
   * Get the total remaining shares
   */
  getTotalShares(): Decimal {
    return this.totalShares;
  }

  /**
   * Get the total cost basis of remaining shares
   */
  getTotalCostBasis(): Decimal {
    return this.totalCostBasis;
  }

  /**
   * Process a BUY transaction
   */
  private processBuy(tx: Transaction): PLResult {
    // Add shares and cost basis
    const purchaseCost = tx.quantity.times(tx.price).plus(tx.fees);

    this.totalShares = this.totalShares.plus(tx.quantity);
    this.totalCostBasis = this.totalCostBasis.plus(purchaseCost);

    return { realizedPL: new Decimal(0), realized_pl: new Decimal(0) };
  }

  /**
   * Process a SELL transaction
   */
  private processSell(tx: Transaction): PLResult {
    const quantityToSell = tx.quantity.abs();

    // Validate we have enough shares
    if (this.totalShares.lt(quantityToSell)) {
      throw new Error(
        `Oversell detected: Attempting to sell ${quantityToSell} shares ` +
          `but only ${this.totalShares} available. ` +
          `Transaction: ${tx.symbol} on ${tx.date}`
      );
    }

    // Calculate P/L using average cost
    const avgCost = this.getAverageCost();
    const costBasis = quantityToSell.times(avgCost);
    const proceeds = quantityToSell.times(tx.price).minus(tx.fees);
    const realizedPL = proceeds.minus(costBasis);

    // Update state
    this.totalShares = this.totalShares.minus(quantityToSell);

    // Recalculate total cost basis based on remaining shares and avg cost
    // This maintains the average cost across sells
    this.totalCostBasis = this.totalShares.times(avgCost);

    this.totalRealizedPL = this.totalRealizedPL.plus(realizedPL);

    return { realizedPL: realizedPL, realized_pl: realizedPL };
  }

  /**
   * Reset the calculator state
   */
  reset(): void {
    this.totalShares = new Decimal(0);
    this.totalCostBasis = new Decimal(0);
    this.totalRealizedPL = new Decimal(0);
  }

  /**
   * Create a snapshot of current state for caching
   */
  getState(): AverageCostCalculatorState {
    return {
      totalShares: this.totalShares,
      totalCostBasis: this.totalCostBasis,
      totalRealizedPL: this.totalRealizedPL,
    };
  }

  /**
   * Restore calculator state from a snapshot
   */
  setState(state: AverageCostCalculatorState): void {
    this.totalShares = state.totalShares;
    this.totalCostBasis = state.totalCostBasis;
    this.totalRealizedPL = state.totalRealizedPL;
  }
}

/**
 * Serializable state snapshot for caching
 */
export interface AverageCostCalculatorState {
  totalShares: Decimal;
  totalCostBasis: Decimal;
  totalRealizedPL: Decimal;
}
