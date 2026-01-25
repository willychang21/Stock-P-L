/**
 * Benchmark Service
 * Orchestrates portfolio vs benchmark comparison using TWR.
 */

import Decimal from 'decimal.js';
import {
  portfolioValueCalculator,
  DailyPortfolioValue,
} from '@domain/calculators/PortfolioValueCalculator';
import { historicalPriceService } from './HistoricalPriceService';
import { plService } from './PLService';

export interface DailyReturn {
  date: string;
  cumulativeReturn: number; // e.g., 0.15 = 15%
  realizedReturn?: number; // e.g., 0.05 = 5% (realized portion)
}

export interface BenchmarkResult {
  symbol: string;
  twr: number;
  dailyReturns: DailyReturn[];
}

export interface PortfolioResult {
  twr: number;
  simpleReturn: number;
  totalPL: Decimal;
  realizedPL: Decimal;
  unrealizedPL: Decimal;
  dailyReturns: DailyReturn[];
}

export interface BenchmarkComparisonResult {
  portfolio: PortfolioResult;
  benchmarks: BenchmarkResult[];
  alpha: number; // Portfolio TWR - Primary Benchmark TWR
  periodStart: string;
  periodEnd: string;
}

const DEFAULT_BENCHMARKS = ['QQQ', 'SPY', 'VOO'];

class BenchmarkService {
  /**
   * Compare portfolio performance against benchmarks.
   */
  async compare(
    benchmarkSymbols: string[] = DEFAULT_BENCHMARKS,
    endDate?: string
  ): Promise<BenchmarkComparisonResult> {
    const todayParts = new Date().toISOString().split('T');
    const todayDate = todayParts[0] ?? '2026-01-01';
    const actualEndDate: string = endDate || todayDate;

    // 1. Get portfolio daily values
    const dailyValues =
      await portfolioValueCalculator.calculateDailyValues(actualEndDate);

    if (dailyValues.length === 0) {
      return this.emptyResult(actualEndDate);
    }

    const firstValue = dailyValues[0];
    if (!firstValue) {
      return this.emptyResult(actualEndDate);
    }

    const startDate: string = firstValue.date;

    // 3. Calculate portfolio simple return and total P/L
    // 3. Calculate portfolio simple return and total P/L
    const holdings = await plService.getAllHoldings();
    let unrealizedPL = new Decimal(0);

    for (const holding of holdings.values()) {
      unrealizedPL = unrealizedPL.plus(holding.unrealizedPL || 0);
    }

    const perfReport = await plService.getTradePerformance();
    const realizedPL = perfReport.overall.totalRealized;

    // Total P/L = Unrealized + Realized
    const totalPL = unrealizedPL.plus(realizedPL);

    // Calculate Max Net Invested Capital to align with chart
    let netInvested = new Decimal(0);
    let maxInvested = new Decimal(0);

    for (const val of dailyValues) {
      netInvested = netInvested.plus(val.cashFlow);
      if (netInvested.gt(maxInvested)) {
        maxInvested = netInvested;
      }
    }

    // Simple Return = Total P/L / Max Invested Capital
    // This is the correct way to measure return on capital at risk
    const simpleReturn = maxInvested.isZero()
      ? 0
      : totalPL.div(maxInvested).toNumber();

    // 4. Calculate portfolio daily cumulative returns for chart
    const portfolioDailyReturns =
      this.calculateDailyCumulativeReturns(dailyValues);

    // Use True Geometric TWR Calculation
    const portfolioTWR = this.calculateGeometricallyLinkedTWR(dailyValues);

    // 5. Fetch benchmark data and calculate returns
    const benchmarkResults: BenchmarkResult[] = [];

    for (const symbol of benchmarkSymbols) {
      const benchmarkResult = await this.calculateBenchmarkReturn(
        symbol,
        startDate,
        actualEndDate
      );
      benchmarkResults.push(benchmarkResult);
    }

    // 6. Calculate alpha (vs first benchmark)
    const firstBenchmark = benchmarkResults[0];
    const primaryBenchmarkTWR = firstBenchmark ? firstBenchmark.twr : 0;
    const alpha = portfolioTWR - primaryBenchmarkTWR;

    return {
      portfolio: {
        twr: portfolioTWR,
        simpleReturn,
        totalPL,
        realizedPL,
        unrealizedPL,
        dailyReturns: portfolioDailyReturns,
      },
      benchmarks: benchmarkResults,
      alpha,
      periodStart: startDate,
      periodEnd: actualEndDate,
    };
  }

  /**
   * Calculate benchmark return from historical prices.
   */
  private async calculateBenchmarkReturn(
    symbol: string,
    startDate: string,
    endDate: string
  ): Promise<BenchmarkResult> {
    const prices = await historicalPriceService.getHistoricalPrices(
      symbol,
      startDate,
      endDate
    );

    if (prices.length === 0) {
      return { symbol, twr: 0, dailyReturns: [] };
    }

    const firstPrice = prices[0];
    const lastPrice = prices[prices.length - 1];

    if (!firstPrice || !lastPrice) {
      return { symbol, twr: 0, dailyReturns: [] };
    }

    const startPrice = firstPrice.close;
    const endPrice = lastPrice.close;

    // Simple return for benchmark (no cash flows)
    const twr = (endPrice - startPrice) / startPrice;

    // Calculate daily cumulative returns
    const dailyReturns: DailyReturn[] = prices.map(p => ({
      date: p.date,
      cumulativeReturn: (p.close - startPrice) / startPrice,
    }));

    return { symbol, twr, dailyReturns };
  }

  /**
   * Calculate daily cumulative returns from portfolio values.
   * Uses Gross Invested Capital (Total Capital Deployed) to stabilize the return curve.
   */
  private calculateDailyCumulativeReturns(
    values: DailyPortfolioValue[]
  ): DailyReturn[] {
    if (values.length === 0) return [];

    // Use Return on Max Net Invested Capital (Total PL / Max Invested)
    // This correctly handles reinvestment without diluting returns
    const returns: DailyReturn[] = [];

    let netInvested = new Decimal(0);
    let maxInvested = new Decimal(0);

    // Iterate ALL values to build cumulative history from start
    for (const val of values) {
      // Net Invested accumulates all flows (+/-)
      // BUY = Positive Flow (into strategy)
      // SELL = Negative Flow (out of strategy)
      // BenchmarkService assumes val.cashFlow handles this directionality appropriately
      // But typically buying increases invested capital, selling decreases it.
      // DailyPortfolioValue.cashFlow:
      // BUY: +amount (Investment)
      // SELL: -amount (Divestment)
      netInvested = netInvested.plus(val.cashFlow);

      // Track High Water Mark of Invested Capital
      if (netInvested.gt(maxInvested)) {
        maxInvested = netInvested;
      }

      let cumulativeReturn = 0;
      let realizedReturnVal = 0;

      // Calculate return based on Total P/L against Max Capital Deployed
      if (!maxInvested.isZero()) {
        const unrealizedPL = val.marketValue.minus(val.costBasis);
        const totalPL = unrealizedPL.plus(val.realizedPL);

        cumulativeReturn = totalPL.div(maxInvested).toNumber();
        realizedReturnVal = val.realizedPL.div(maxInvested).toNumber();
      }

      returns.push({
        date: val.date,
        cumulativeReturn,
        realizedReturn: realizedReturnVal,
      });
    }

    return returns;
  }

  /**
   * Calculate Time-Weighted Return (TWR) using Geometric Linking.
   * Formula: TWR = (1 + r1) * (1 + r2) * ... * (1 + rn) - 1
   * Where r_i = (MV_end - CashFlow) / MV_start - 1
   */
  private calculateGeometricallyLinkedTWR(
    values: DailyPortfolioValue[]
  ): number {
    if (values.length === 0) return 0;

    let cumulativeTWR = 0;
    let prevMarketValue = new Decimal(0);

    // Sort by date just in case
    const sortedValues = [...values].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    for (let i = 0; i < sortedValues.length; i++) {
      const val = sortedValues[i];
      if (!val) continue;

      const cashFlow = val.cashFlow;
      const endMarketValue = val.marketValue;

      // For TWR, we need the Portfolio Value BEFORE the cash flow to calculate the return generated by the manager
      // MV_end = MV_start * (1 + r) + CashFlow
      // => MV_end - CashFlow = MV_start * (1 + r)
      // => (MV_end - CashFlow) / MV_start = 1 + r
      // => r = (MV_end - CashFlow) / MV_start - 1

      // On Day 1, Start Value is effectively the initial CashFlow (deposit)
      // So r = (MV_end - CF) / 0 ... undefined?
      // Standard approach for Day 1:
      // If it's the very first deposit, the return is just (MV_end - Deposit) / Deposit?
      // Or we can treat the "Start Value" as 0, and the CashFlow establishes the baseline.
      // If Previous MV is 0, we can't calculate a return percentage from 0.
      // We essentially skip the return calculation for the exact moment of initial deposit
      // and start tracking from the next period?
      // BETTER:
      // Period 1: Deposit $100. End of Day $110.
      // MV_start = 0. CashFlow = 100. MV_end = 110.
      // Adjusted End = 110 - 100 = 10.
      // Return on 0 is undefined.
      // This implies the return happened ON the $100.
      // Modification for Day 1:
      // Denominator should be (PrevMV + CashFlow) if we assume cash flow happened at valid start?
      // GIPS often assumes Modified Dietz or specific timing.
      // Simplified Geometric:
      // Denominator = PrevMV + WeightedCashFlow.
      // If we assume Cash Flow happens at START of day:
      // Denominator = PrevMV + CashFlow.
      // r = (MV_end) / (PrevMV + CashFlow) - 1.

      const denominator = prevMarketValue.plus(cashFlow);
      let dailyReturn = 0;

      if (!denominator.isZero()) {
        dailyReturn = endMarketValue.div(denominator).minus(1).toNumber();
      }

      // Chain the return
      cumulativeTWR = (1 + cumulativeTWR) * (1 + dailyReturn) - 1;

      // Update PrevMarketValue for next day
      prevMarketValue = endMarketValue;
    }

    return cumulativeTWR;
  }

  /**
   * Return empty result structure.
   */
  private emptyResult(endDate: string): BenchmarkComparisonResult {
    return {
      portfolio: {
        twr: 0,
        simpleReturn: 0,
        totalPL: new Decimal(0),
        realizedPL: new Decimal(0),
        unrealizedPL: new Decimal(0),
        dailyReturns: [],
      },
      benchmarks: [],
      alpha: 0,
      periodStart: '',
      periodEnd: endDate,
    };
  }
}

export const benchmarkService = new BenchmarkService();
