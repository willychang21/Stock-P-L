import Decimal from 'decimal.js';
import { Transaction, TransactionType } from '../models/Transaction';
import { Lot } from '../models/Holding';
import { PLResult, LotMatch } from '../models/PLReport';

/**
 * FIFO (First-In-First-Out) P/L Calculator
 *
 * This is the IRS default method for cost basis calculation.
 * It matches SELL transactions with the oldest BUY transactions first.
 *
 * Key properties:
 * - Deterministic: same transactions → same P/L
 * - Auditable: tracks which lots were consumed
 * - Tax-compliant: matches IRS requirements and broker 1099-B forms
 */
export class FIFOCalculator {
  private lotQueue: Lot[] = []; // Oldest first (FIFO queue)
  private totalRealizedPL: Decimal = new Decimal(0);

  /**
   * Process a single transaction and update internal state
   * @param tx Transaction to process
   * @returns PLResult with realized P/L and matched lots (for SELL)
   * @throws Error if attempting to oversell
   */
  processTransaction(tx: Transaction): PLResult {
    if (tx.transaction_type === TransactionType.BUY) {
      return this.addLot(tx);
    } else if (tx.transaction_type === TransactionType.SELL) {
      return this.consumeLots(tx);
    } else {
      // DIVIDEND, FEE, etc. don't affect position or P/L calculation
      return { realized_pl: new Decimal(0) };
    }
  }

  /**
   * Get the current total realized P/L
   */
  getTotalRealizedPL(): Decimal {
    return this.totalRealizedPL;
  }

  /**
   * Get the current lot queue (for inspection/debugging)
   */
  getLots(): Lot[] {
    return [...this.lotQueue]; // Return copy to prevent mutation
  }

  /**
   * Get the total remaining shares across all lots
   */
  getTotalShares(): Decimal {
    return this.lotQueue.reduce(
      (sum, lot) => sum.plus(lot.quantity),
      new Decimal(0)
    );
  }

  /**
   * Get the total cost basis of remaining shares
   */
  getTotalCostBasis(): Decimal {
    return this.lotQueue.reduce(
      (sum, lot) => sum.plus(lot.quantity.times(lot.cost_basis_per_share)),
      new Decimal(0)
    );
  }

  /**
   * Add a new lot from a BUY transaction
   */
  private addLot(tx: Transaction): PLResult {
    // Safety check: Don't add lots with zero or negative quantity (BUYs should be positive)
    if (tx.quantity.lte(0)) {
      console.warn(
        `⚠️ Skipped BUY/addLot for ${tx.symbol} due to non-positive quantity: ${tx.quantity}`
      );
      return { realized_pl: new Decimal(0) };
    }

    // Cost basis per share = price + (fees / quantity)
    // Fees are allocated proportionally to each share
    let costBasisPerShare = tx.price.plus(tx.fees.div(tx.quantity));

    // Safety check: If cost basis is NaN (e.g. invalid price), default to Price or 0 to avoid contaminating average
    if (costBasisPerShare.isNaN()) {
      console.warn(
        `⚠️ NaN Cost Basis detected for ${tx.symbol}. Defaulting to Price.`
      );
      costBasisPerShare = tx.price.isNaN() ? new Decimal(0) : tx.price;
    }

    const newLot: Lot = {
      purchase_date: tx.transaction_date,
      quantity: tx.quantity, // Already positive for BUY
      cost_basis_per_share: costBasisPerShare,
      transaction_id: tx.id,
    };

    this.lotQueue.push(newLot);

    return { realized_pl: new Decimal(0) }; // No P/L on purchases
  }

  /**
   * Consume lots from the queue for a SELL transaction
   * Uses FIFO: oldest lots are consumed first
   */
  private consumeLots(tx: Transaction): PLResult {
    const quantityToSell = tx.quantity.abs(); // SELL has negative quantity
    let remainingToSell = quantityToSell;
    let totalRealizedPL = new Decimal(0);
    const matchedLots: LotMatch[] = [];

    // Validate we have enough shares to sell
    const totalAvailable = this.getTotalShares();
    if (totalAvailable.lt(quantityToSell)) {
      throw new Error(
        `Oversell detected: Attempting to sell ${quantityToSell} shares ` +
          `but only ${totalAvailable} available. ` +
          `Transaction: ${tx.symbol} on ${tx.transaction_date}`
      );
    }

    // Consume lots in FIFO order
    while (remainingToSell.gt(0) && this.lotQueue.length > 0) {
      const lot = this.lotQueue[0]!; // We know it exists from validation
      const sellFromThisLot = Decimal.min(remainingToSell, lot.quantity);

      // Calculate P/L for this lot match
      const costBasis = sellFromThisLot.times(lot.cost_basis_per_share);

      // Proceeds = sale price * quantity - (fees prorated by quantity)
      const feesProratedForThisLot = tx.fees.times(
        sellFromThisLot.div(quantityToSell)
      );
      const proceeds = sellFromThisLot
        .times(tx.price)
        .minus(feesProratedForThisLot);

      const realizedPL = proceeds.minus(costBasis);

      // Record the match for audit trail
      matchedLots.push({
        lot: { ...lot }, // Copy of the lot before modification
        quantity_sold: sellFromThisLot,
        pl: realizedPL,
        purchase_date: lot.purchase_date,
        sale_date: tx.transaction_date,
      });

      totalRealizedPL = totalRealizedPL.plus(realizedPL);

      // Update lot quantity
      lot.quantity = lot.quantity.minus(sellFromThisLot);

      // Remove lot if fully consumed
      if (lot.quantity.isZero()) {
        this.lotQueue.shift();
      }

      remainingToSell = remainingToSell.minus(sellFromThisLot);
    }

    // Update total realized P/L
    this.totalRealizedPL = this.totalRealizedPL.plus(totalRealizedPL);

    return {
      realized_pl: totalRealizedPL,
      matched_lots: matchedLots,
    };
  }

  /**
   * Reset the calculator state
   */
  reset(): void {
    this.lotQueue = [];
    this.totalRealizedPL = new Decimal(0);
  }

  /**
   * Create a snapshot of current state for caching
   */
  getState(): FIFOCalculatorState {
    return {
      lots: this.lotQueue.map(lot => ({ ...lot })),
      totalRealizedPL: this.totalRealizedPL,
    };
  }

  /**
   * Restore calculator state from a snapshot
   */
  setState(state: FIFOCalculatorState): void {
    this.lotQueue = state.lots.map(lot => ({ ...lot }));
    this.totalRealizedPL = state.totalRealizedPL;
  }
}

/**
 * Serializable state snapshot for caching
 */
export interface FIFOCalculatorState {
  lots: Lot[];
  totalRealizedPL: Decimal;
}
