import { ICalculator, MarketDataMap } from './ICalculator';
import { Transaction, TransactionType } from '../models/Transaction';
import { AnalysisResult } from '../models/AnalysisResult';
import Decimal from 'decimal.js';

export class WeightedAverageCalculator implements ICalculator {
  calculate(transactions: Transaction[], _marketData: MarketDataMap): AnalysisResult {
    const sortedTxs = [...transactions].sort((a, b) => a.date.getTime() - b.date.getTime());
    
    let totalQty = new Decimal(0);
    let totalCostBasis = new Decimal(0);
    let totalRealizedPL = new Decimal(0);

    for (const tx of sortedTxs) {
      if (tx.type === TransactionType.BUY) {
        const costBasis = tx.quantity.mul(tx.price).plus(tx.fees);
        totalQty = totalQty.plus(tx.quantity);
        totalCostBasis = totalCostBasis.plus(costBasis);
      } else if (tx.type === TransactionType.SELL) {
        const sellQty = tx.quantity.abs();
        if (totalQty.isZero()) continue;

        const avgCostPerShare = totalCostBasis.div(totalQty);
        const costOfSoldShares = sellQty.mul(avgCostPerShare);
        const proceeds = sellQty.mul(tx.price).minus(tx.fees);
        
        totalRealizedPL = totalRealizedPL.plus(proceeds.minus(costOfSoldShares));
        
        totalQty = totalQty.minus(sellQty);
        totalCostBasis = totalCostBasis.minus(costOfSoldShares);
      }
    }

    return {
      calculatorId: 'weighted_avg',
      metrics: {
        totalRealizedPL,
        holdings: totalQty,
        costBasis: totalCostBasis,
      },
      generatedAt: new Date()
    };
  }

  metadata() {
    return {
      id: 'weighted_avg',
      name: 'Weighted Average',
      description: 'Calculates cost basis by averaging all purchase prices.'
    };
  }
}
