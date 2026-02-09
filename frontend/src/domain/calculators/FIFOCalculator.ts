import { ICalculator, MarketDataMap } from './ICalculator';
import { Transaction, TransactionType } from '../models/Transaction';
import { AnalysisResult } from '../models/AnalysisResult';
import { PLResult } from '../models/PLReport';
import { Lot as HoldingLot } from '../models/Holding';
import Decimal from 'decimal.js';

interface InternalLot {
  id: string;
  purchase_date: string;
  quantity: Decimal;
  price: Decimal;
  fees: Decimal;
  costBasisPerShare: Decimal;
}

export class FIFOCalculator implements ICalculator {
  private lots: InternalLot[] = [];
  private totalRealizedPL: Decimal = new Decimal(0);

  /**
   * Process a single transaction (Legacy support for PLService)
   */
  processTransaction(tx: Transaction): PLResult {
    if (tx.type === TransactionType.BUY) {
      const costBasisPerShare = tx.price.plus(tx.fees.div(tx.quantity));
      this.lots.push({
        id: tx.id,
        purchase_date: tx.date.toISOString(),
        quantity: tx.quantity,
        price: tx.price,
        fees: tx.fees,
        costBasisPerShare,
      });
      return { realizedPL: new Decimal(0), realized_pl: new Decimal(0) };
    } else if (tx.type === TransactionType.SELL) {
      let remainingToSell = tx.quantity.abs();
      const sellPrice = tx.price;
      const totalSellQty = remainingToSell;
      let txRealizedPL = new Decimal(0);
      const matchedLots = [];

      while (remainingToSell.gt(0) && this.lots.length > 0) {
        const currentLot = this.lots[0]!;
        const sellFromLot = Decimal.min(remainingToSell, currentLot.quantity);

        const costBasis = sellFromLot.mul(currentLot.costBasisPerShare);
        const feesProrated = tx.fees.mul(sellFromLot.div(totalSellQty));
        const proceeds = sellFromLot.mul(sellPrice).minus(feesProrated);

        const pl = proceeds.minus(costBasis);
        txRealizedPL = txRealizedPL.plus(pl);

        matchedLots.push({
          lot: {
            id: currentLot.id,
            purchaseDate: currentLot.purchase_date,
            quantity: currentLot.quantity,
            price: currentLot.price,
            fees: currentLot.fees,
            costBasisPerShare: currentLot.costBasisPerShare,
          },
          quantitySold: sellFromLot,
        });

        currentLot.quantity = currentLot.quantity.minus(sellFromLot);
        remainingToSell = remainingToSell.minus(sellFromLot);

        if (currentLot.quantity.isZero()) {
          this.lots.shift();
        }
      }
      this.totalRealizedPL = this.totalRealizedPL.plus(txRealizedPL);
      return {
        realizedPL: txRealizedPL,
        realized_pl: txRealizedPL,
        matchedLots: matchedLots as any,
      };
    }
    return { realizedPL: new Decimal(0), realized_pl: new Decimal(0) };
  }

  getTotalRealizedPL(): Decimal {
    return this.totalRealizedPL;
  }

  getTotalShares(): Decimal {
    return this.lots.reduce(
      (acc, lot) => acc.plus(lot.quantity),
      new Decimal(0)
    );
  }

  getTotalCostBasis(): Decimal {
    return this.lots.reduce(
      (acc, lot) => acc.plus(lot.quantity.mul(lot.costBasisPerShare)),
      new Decimal(0)
    );
  }

  getLots(): HoldingLot[] {
    return this.lots.map(lot => ({
      id: lot.id,
      purchase_date: lot.purchase_date,
      quantity: lot.quantity,
      price: lot.price,
      fees: lot.fees,
      cost_basis_per_share: lot.costBasisPerShare,
    }));
  }

  /**
   * Implementation of ICalculator interface
   */
  calculate(
    transactions: Transaction[],
    _marketData: MarketDataMap
  ): AnalysisResult {
    const sortedTxs = [...transactions].sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );

    // Reset internal state for bulk calculation
    this.lots = [];
    this.totalRealizedPL = new Decimal(0);

    for (const tx of sortedTxs) {
      this.processTransaction(tx);
    }

    return {
      calculatorId: 'fifo',
      metrics: {
        totalRealizedPL: this.totalRealizedPL,
        holdings: this.getTotalShares(),
        costBasis: this.getTotalCostBasis(),
      },
      generatedAt: new Date(),
    };
  }

  metadata() {
    return {
      id: 'fifo',
      name: 'First In First Out',
      description: 'Calculates cost basis based on the earliest purchase.',
    };
  }
}
