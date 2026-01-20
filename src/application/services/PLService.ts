import Decimal from 'decimal.js';
import { transactionRepo } from '@infrastructure/storage/TransactionRepository';
import { FIFOCalculator } from '@domain/calculators/FIFOCalculator';
import { AverageCostCalculator } from '@domain/calculators/AverageCostCalculator';
import { CostBasisMethod } from '@domain/models/PLReport';
import { Holding, createEmptyHolding } from '@domain/models/Holding';
import { priceService } from './PriceService';
import {
  TransactionWithPL,
  SymbolTransactionSummary,
} from '@domain/models/SymbolTransactionSummary';
import { TransactionType } from '@domain/models/Transaction';

export interface TradeStats {
  winCount: number;
  lossCount: number;
  totalWin: Decimal;
  totalLoss: Decimal;
  winRate: number;
  profitFactor: number;
  totalRealized: Decimal;
  averageWin: Decimal;
  averageLoss: Decimal;
}

export interface PerformanceReport {
  overall: TradeStats;
  byAssetType: {
    EQUITY: TradeStats;
    ETF: TradeStats;
    UNKNOWN: TradeStats;
  };
}

// Time-based performance types
export type TimePeriod = 'yearly' | 'quarterly' | 'monthly';
export type AssetFilter = 'ALL' | 'EQUITY' | 'ETF';

export interface PeriodStats {
  period: string; // e.g., "2024", "2024-Q1", "2024-01"
  realizedPL: Decimal;
  tradeCount: number;
  winCount: number;
  lossCount: number;
  winRate: number;
}

export interface TimePerformanceReport {
  periods: PeriodStats[];
  assetFilter: AssetFilter;
  timePeriod: TimePeriod;
}

function emptyStats(): TradeStats {
  return {
    winCount: 0,
    lossCount: 0,
    totalWin: new Decimal(0),
    totalLoss: new Decimal(0),
    winRate: 0,
    profitFactor: 0,
    totalRealized: new Decimal(0),
    averageWin: new Decimal(0),
    averageLoss: new Decimal(0),
  };
}

export class PLService {
  async getTradePerformance(
    method: CostBasisMethod = 'FIFO'
  ): Promise<PerformanceReport> {
    const report: PerformanceReport = {
      overall: emptyStats(),
      byAssetType: {
        EQUITY: emptyStats(),
        ETF: emptyStats(),
        UNKNOWN: emptyStats(),
      },
    };

    // Helper to update stats
    const updateStats = (stats: TradeStats, pl: Decimal) => {
      if (pl.gt(0)) {
        stats.winCount++;
        stats.totalWin = stats.totalWin.plus(pl);
      } else if (pl.lt(0)) {
        stats.lossCount++;
        stats.totalLoss = stats.totalLoss.plus(pl);
      }
      stats.totalRealized = stats.totalRealized.plus(pl);
    };

    const symbols = await transactionRepo.getAllSymbols();

    for (const symbol of symbols) {
      let typeStr = priceService.getAssetType(symbol);
      let type: 'EQUITY' | 'ETF' | 'UNKNOWN' = 'UNKNOWN';
      if (typeStr === 'EQUITY') type = 'EQUITY';
      else if (typeStr === 'ETF') type = 'ETF';

      const allTxs = await transactionRepo.findBySymbol(symbol);
      const calculator =
        method === 'FIFO' ? new FIFOCalculator() : new AverageCostCalculator();

      for (const tx of allTxs) {
        const result = calculator.processTransaction(tx);

        // Count Realized P/L from SELLS
        if (tx.transaction_type === 'SELL') {
          const pl = result.realized_pl;
          updateStats(report.overall, pl);
          updateStats(report.byAssetType[type], pl);
        }
      }
    }

    // Finalize calculations (Win Rate, Profit Factor)
    const finalize = (stats: TradeStats) => {
      const totalTrades = stats.winCount + stats.lossCount;
      stats.winRate =
        totalTrades > 0 ? (stats.winCount / totalTrades) * 100 : 0;

      if (stats.totalLoss.isZero()) {
        stats.profitFactor = stats.totalWin.gt(0) ? Infinity : 0;
      } else {
        stats.profitFactor = stats.totalWin
          .div(stats.totalLoss.abs())
          .toNumber();
      }

      stats.averageWin =
        stats.winCount > 0
          ? stats.totalWin.div(stats.winCount)
          : new Decimal(0);
      stats.averageLoss =
        stats.lossCount > 0
          ? stats.totalLoss.div(stats.lossCount)
          : new Decimal(0);
    };

    finalize(report.overall);
    finalize(report.byAssetType.EQUITY);
    finalize(report.byAssetType.ETF);
    finalize(report.byAssetType.UNKNOWN);

    return report;
  }

  /**
   * Get all transactions for a symbol with realized P/L for each SELL
   */
  async getTransactionsWithPL(
    symbol: string,
    method: CostBasisMethod = 'FIFO'
  ): Promise<SymbolTransactionSummary> {
    const allTxs = await transactionRepo.findBySymbol(symbol);
    const calculator =
      method === 'FIFO' ? new FIFOCalculator() : new AverageCostCalculator();

    const transactionsWithPL: TransactionWithPL[] = [];
    let totalRealizedPL = new Decimal(0);
    let buyCount = 0;
    let sellCount = 0;

    for (const tx of allTxs) {
      const result = calculator.processTransaction(tx);

      if (tx.transaction_type === TransactionType.BUY) {
        buyCount++;
        transactionsWithPL.push({
          transaction: tx,
          realized_pl: null,
          return_percentage: null,
          cost_basis: null,
        });
      } else if (tx.transaction_type === TransactionType.SELL) {
        sellCount++;
        const realizedPL = result.realized_pl;
        totalRealizedPL = totalRealizedPL.plus(realizedPL);

        // Calculate cost basis from matched lots for return percentage
        let costBasisForSell = new Decimal(0);
        if (result.matched_lots) {
          for (const match of result.matched_lots) {
            costBasisForSell = costBasisForSell.plus(
              match.quantity_sold.times(match.lot.cost_basis_per_share)
            );
          }
        }

        const returnPct = costBasisForSell.isZero()
          ? new Decimal(0)
          : realizedPL.div(costBasisForSell).times(100);

        transactionsWithPL.push({
          transaction: tx,
          realized_pl: realizedPL,
          return_percentage: returnPct,
          cost_basis: costBasisForSell,
        });
      } else {
        // DIVIDEND, FEE, etc.
        transactionsWithPL.push({
          transaction: tx,
          realized_pl: null,
          return_percentage: null,
          cost_basis: null,
        });
      }
    }

    return {
      symbol,
      transactions: transactionsWithPL,
      total_realized_pl: totalRealizedPL,
      total_buy_count: buyCount,
      total_sell_count: sellCount,
    };
  }

  async calculateRealizedPL(
    symbol: string,
    startDate: string,
    endDate: string,
    method: CostBasisMethod = 'FIFO'
  ): Promise<Decimal> {
    const allTxs = await transactionRepo.findUpToDate(endDate, symbol);
    const calculator =
      method === 'FIFO' ? new FIFOCalculator() : new AverageCostCalculator();

    let totalRealizedPL = new Decimal(0);

    for (const tx of allTxs) {
      const result = calculator.processTransaction(tx);
      if (
        tx.transaction_type === 'SELL' &&
        tx.transaction_date >= startDate &&
        tx.transaction_date <= endDate
      ) {
        totalRealizedPL = totalRealizedPL.plus(result.realized_pl);
      }
    }
    return totalRealizedPL;
  }

  async getHolding(
    symbol: string,
    method: CostBasisMethod = 'FIFO'
  ): Promise<Holding> {
    const allTxs = await transactionRepo.findBySymbol(symbol);
    const calculator =
      method === 'FIFO' ? new FIFOCalculator() : new AverageCostCalculator();

    for (const tx of allTxs) {
      calculator.processTransaction(tx);
    }

    const holding = createEmptyHolding(symbol);
    holding.assetType = priceService.getAssetType(symbol) || 'UNKNOWN';
    holding.total_shares = calculator.getTotalShares();
    holding.cost_basis = calculator.getTotalCostBasis();

    if (method === 'FIFO' && calculator instanceof FIFOCalculator) {
      holding.lots = calculator.getLots();
      holding.average_cost = holding.total_shares.isZero()
        ? new Decimal(0)
        : holding.cost_basis.div(holding.total_shares);
    } else if (calculator instanceof AverageCostCalculator) {
      holding.average_cost = calculator.getAverageCost();
    }

    return holding;
  }

  async getAllHoldings(
    method: CostBasisMethod = 'FIFO'
  ): Promise<Map<string, Holding>> {
    const symbols = await transactionRepo.getAllSymbols();
    const holdings = new Map<string, Holding>();

    for (const symbol of symbols) {
      const holding = await this.getHolding(symbol, method);

      // Filter dust
      if (holding.total_shares.gt(0.000001)) {
        holdings.set(symbol, holding);
      }
    }

    return holdings;
  }

  // Helper for generating full report (if needed by useStore)
  async generatePLReport(
    startDate: string,
    endDate: string,
    _method: CostBasisMethod,
    _currentPrices: Map<string, Decimal>
  ) {
    // Placeholder for full report generation if invoked
    // Implementation similar to getTradePerformance but with Symbol detail
    // For now, returning empty object or simple report
    return {
      startDate,
      endDate,
      summary: {
        totalRealizedPL: new Decimal(0),
        totalUnrealizedPL: new Decimal(0),
        totalFees: new Decimal(0),
        netProfit: new Decimal(0),
      },
      symbols: [],
    };
  }

  /**
   * Get performance aggregated by time period (yearly/quarterly/monthly)
   */
  async getPerformanceByTimePeriod(
    timePeriod: TimePeriod,
    assetFilter: AssetFilter,
    method: CostBasisMethod = 'FIFO'
  ): Promise<TimePerformanceReport> {
    const periodMap = new Map<
      string,
      {
        realizedPL: Decimal;
        tradeCount: number;
        winCount: number;
        lossCount: number;
      }
    >();

    const symbols = await transactionRepo.getAllSymbols();

    for (const symbol of symbols) {
      // Apply asset filter
      const typeStr = priceService.getAssetType(symbol);
      if (assetFilter !== 'ALL') {
        if (assetFilter === 'EQUITY' && typeStr !== 'EQUITY') continue;
        if (assetFilter === 'ETF' && typeStr !== 'ETF') continue;
      }

      const allTxs = await transactionRepo.findBySymbol(symbol);
      const calculator =
        method === 'FIFO' ? new FIFOCalculator() : new AverageCostCalculator();

      for (const tx of allTxs) {
        const result = calculator.processTransaction(tx);

        if (tx.transaction_type === 'SELL') {
          const periodKey = this.getPeriodKey(tx.transaction_date, timePeriod);
          const pl = result.realized_pl;

          if (!periodMap.has(periodKey)) {
            periodMap.set(periodKey, {
              realizedPL: new Decimal(0),
              tradeCount: 0,
              winCount: 0,
              lossCount: 0,
            });
          }

          const stats = periodMap.get(periodKey)!;
          stats.realizedPL = stats.realizedPL.plus(pl);
          stats.tradeCount++;
          if (pl.gt(0)) stats.winCount++;
          else if (pl.lt(0)) stats.lossCount++;
        }
      }
    }

    // Convert map to sorted array
    const periods: PeriodStats[] = Array.from(periodMap.entries())
      .map(([period, stats]) => ({
        period,
        realizedPL: stats.realizedPL,
        tradeCount: stats.tradeCount,
        winCount: stats.winCount,
        lossCount: stats.lossCount,
        winRate:
          stats.tradeCount > 0 ? (stats.winCount / stats.tradeCount) * 100 : 0,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));

    return {
      periods,
      assetFilter,
      timePeriod,
    };
  }

  /**
   * Update transaction notes
   */
  async updateTransactionNotes(id: string, notes: string): Promise<void> {
    await transactionRepo.updateNotes(id, notes);
  }

  /**
   * Get period key from date based on time period type
   */
  private getPeriodKey(dateStr: string, timePeriod: TimePeriod): string {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    switch (timePeriod) {
      case 'yearly':
        return `${year}`;
      case 'quarterly':
        const quarter = Math.ceil(month / 3);
        return `${year}-Q${quarter}`;
      case 'monthly':
        return `${year}-${month.toString().padStart(2, '0')}`;
    }
  }
}

export const plService = new PLService();
