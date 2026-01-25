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

// DCA (Dollar Cost Averaging) Types
export type DCAFrequency = 'weekly' | 'biweekly' | 'monthly';

export interface DCASettings {
  frequency: DCAFrequency;
  amountPerInvestment: number;
  startDate?: string; // defaults to first portfolio transaction
  endDate?: string; // defaults to today
}

export interface DCABenchmarkResult {
  symbol: string;
  totalInvested: number;
  finalValue: number;
  totalReturn: number; // percentage
  dailyReturns: DailyReturn[];
}

export interface BenchmarkResult {
  symbol: string;
  twr: number; // Lump sum return (traditional: buy at start, hold)
  cashFlowWeightedReturn: number; // Same cash flows as portfolio
  dailyReturns: DailyReturn[];
  cashFlowWeightedDailyReturns: DailyReturn[]; // Daily returns using CF weighting
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
  alpha: number; // Portfolio TWR - Primary Benchmark TWR (Lump Sum)
  cashFlowWeightedAlpha: number; // Portfolio Return - Benchmark CF Weighted Return
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

    // 1. First get daily values (needed for date range)
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

    // 2. Fetch all data in PARALLEL for maximum performance
    // Use getAllHoldings (with optimized batch price fetching) for unrealized P/L calculation
    const [holdings, perfReport, ...benchmarkResults] = await Promise.all([
      plService.getAllHoldings(),
      plService.getTradePerformance(),
      ...benchmarkSymbols.map(symbol =>
        this.calculateBenchmarkReturn(
          symbol,
          startDate,
          actualEndDate,
          dailyValues
        )
      ),
    ]);

    // 3. Calculate portfolio metrics from parallel results
    let unrealizedPL = new Decimal(0);
    for (const holding of holdings.values()) {
      unrealizedPL = unrealizedPL.plus(holding.unrealizedPL || 0);
    }

    const realizedPL = perfReport.overall.totalRealized;
    const totalPL = unrealizedPL.plus(realizedPL);

    // 4. Calculate Max Net Invested Capital
    let netInvested = new Decimal(0);
    let maxInvested = new Decimal(0);

    for (const val of dailyValues) {
      netInvested = netInvested.plus(val.cashFlow);
      if (netInvested.gt(maxInvested)) {
        maxInvested = netInvested;
      }
    }

    // Simple Return = Total P/L / Max Invested Capital
    const simpleReturn = maxInvested.isZero()
      ? 0
      : totalPL.div(maxInvested).toNumber();

    // 5. Calculate portfolio daily cumulative returns for chart
    const portfolioDailyReturns =
      this.calculateDailyCumulativeReturns(dailyValues);

    // Use True Geometric TWR Calculation
    const portfolioTWR = this.calculateGeometricallyLinkedTWR(dailyValues);

    // 6. Calculate alphas (vs first benchmark)
    const firstBenchmark = benchmarkResults[0];
    // Traditional Alpha: Portfolio TWR vs Benchmark Lump Sum
    const primaryBenchmarkTWR = firstBenchmark ? firstBenchmark.twr : 0;
    const alpha = portfolioTWR - primaryBenchmarkTWR;

    // Cash-Flow Weighted Alpha: Portfolio Return vs Benchmark Same Timing
    const primaryBenchmarkCFR = firstBenchmark
      ? firstBenchmark.cashFlowWeightedReturn
      : 0;
    const cashFlowWeightedAlpha = simpleReturn - primaryBenchmarkCFR;

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
      cashFlowWeightedAlpha,
      periodStart: startDate,
      periodEnd: actualEndDate,
    };
  }

  /**
   * Calculate benchmark return from historical prices.
   * Now includes cash-flow weighted return for fair comparison.
   */
  private async calculateBenchmarkReturn(
    symbol: string,
    startDate: string,
    endDate: string,
    dailyValues?: DailyPortfolioValue[]
  ): Promise<BenchmarkResult> {
    const prices = await historicalPriceService.getHistoricalPrices(
      symbol,
      startDate,
      endDate
    );

    if (prices.length === 0) {
      return {
        symbol,
        twr: 0,
        cashFlowWeightedReturn: 0,
        dailyReturns: [],
        cashFlowWeightedDailyReturns: [],
      };
    }

    const firstPrice = prices[0];
    const lastPrice = prices[prices.length - 1];

    if (!firstPrice || !lastPrice) {
      return {
        symbol,
        twr: 0,
        cashFlowWeightedReturn: 0,
        dailyReturns: [],
        cashFlowWeightedDailyReturns: [],
      };
    }

    const startPrice = firstPrice.close;
    const endPrice = lastPrice.close;

    // === 1. Traditional TWR (Lump Sum) ===
    // Assumes all money invested at start
    const twr = (endPrice - startPrice) / startPrice;

    // Daily cumulative returns for lump sum
    const dailyReturns: DailyReturn[] = prices.map(p => ({
      date: p.date,
      cumulativeReturn: (p.close - startPrice) / startPrice,
    }));

    // === 2. Cash-Flow Weighted Return ===
    // Simulates buying benchmark with same timing/amounts as portfolio
    const { cfReturn, cfDailyReturns } = this.simulateCashFlowWeightedBenchmark(
      prices,
      dailyValues || []
    );

    return {
      symbol,
      twr,
      cashFlowWeightedReturn: cfReturn,
      dailyReturns,
      cashFlowWeightedDailyReturns: cfDailyReturns,
    };
  }

  /**
   * Simulate buying benchmark using the same cash flows as the portfolio.
   * This answers: "If I invested in {benchmark} instead of my stocks,
   * at the same times and amounts, what would my return be?"
   */
  private simulateCashFlowWeightedBenchmark(
    prices: { date: string; close: number }[],
    dailyValues: DailyPortfolioValue[]
  ): { cfReturn: number; cfDailyReturns: DailyReturn[] } {
    if (prices.length === 0 || dailyValues.length === 0) {
      return { cfReturn: 0, cfDailyReturns: [] };
    }

    // Build a price lookup by date
    const priceByDate = new Map<string, number>();
    for (const p of prices) {
      priceByDate.set(p.date, p.close);
    }

    // Helper to get nearest available price for a date
    const getPrice = (date: string): number => {
      if (priceByDate.has(date)) return priceByDate.get(date)!;
      // Find closest previous date
      const sortedDates = Array.from(priceByDate.keys()).sort();
      for (let i = sortedDates.length - 1; i >= 0; i--) {
        if (sortedDates[i]! <= date) return priceByDate.get(sortedDates[i]!)!;
      }
      // Or first available
      return prices[0]?.close || 0;
    };

    // Simulate buying benchmark shares with each cash flow
    let totalShares = new Decimal(0);
    let totalInvested = new Decimal(0);
    let maxInvested = new Decimal(0);
    const cfDailyReturns: DailyReturn[] = [];

    for (const val of dailyValues) {
      const cashFlow = val.cashFlow;
      const price = getPrice(val.date);

      if (price > 0 && !cashFlow.isZero()) {
        // Positive cash flow = BUY shares of benchmark
        // Negative cash flow = SELL shares of benchmark
        const sharesDelta = cashFlow.div(price);
        totalShares = totalShares.plus(sharesDelta);
        totalInvested = totalInvested.plus(cashFlow);

        if (totalInvested.gt(maxInvested)) {
          maxInvested = totalInvested;
        }
      }

      // Calculate current benchmark portfolio value
      const currentPrice = getPrice(val.date);
      const benchmarkValue = totalShares.times(currentPrice);

      // Calculate return on max invested capital (consistent with portfolio calculation)
      let cumulativeReturn = 0;
      if (!maxInvested.isZero()) {
        const benchmarkPL = benchmarkValue.minus(totalInvested);
        cumulativeReturn = benchmarkPL.div(maxInvested).toNumber();
      }

      cfDailyReturns.push({
        date: val.date,
        cumulativeReturn,
      });
    }

    // Final return
    const lastPrice = prices[prices.length - 1]?.close || 0;
    const finalBenchmarkValue = totalShares.times(lastPrice);
    const cfReturn = maxInvested.isZero()
      ? 0
      : finalBenchmarkValue.minus(totalInvested).div(maxInvested).toNumber();

    return { cfReturn, cfDailyReturns };
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
      cashFlowWeightedAlpha: 0,
      periodStart: '',
      periodEnd: endDate,
    };
  }

  /**
   * Simulate DCA (Dollar Cost Averaging) for a benchmark.
   * User can customize frequency and amount per investment.
   */
  async simulateDCA(
    symbol: string,
    settings: DCASettings,
    startDate: string,
    endDate: string
  ): Promise<DCABenchmarkResult> {
    const prices = await historicalPriceService.getHistoricalPrices(
      symbol,
      startDate,
      endDate
    );

    if (prices.length === 0) {
      return {
        symbol,
        totalInvested: 0,
        finalValue: 0,
        totalReturn: 0,
        dailyReturns: [],
      };
    }

    // Build price lookup by date
    const priceByDate = new Map<string, number>();
    for (const p of prices) {
      priceByDate.set(p.date, p.close);
    }

    // Generate DCA investment dates based on frequency
    const investmentDates = this.generateDCADates(
      startDate,
      endDate,
      settings.frequency
    );

    // Simulate DCA investments
    let totalShares = new Decimal(0);
    let totalInvested = new Decimal(0);
    const dailyReturns: DailyReturn[] = [];

    // Helper to get nearest available price
    const getPrice = (date: string): number => {
      if (priceByDate.has(date)) return priceByDate.get(date)!;
      const sortedDates = Array.from(priceByDate.keys()).sort();
      for (let i = sortedDates.length - 1; i >= 0; i--) {
        if (sortedDates[i]! <= date) return priceByDate.get(sortedDates[i]!)!;
      }
      return prices[0]?.close || 0;
    };

    // Process each investment date
    for (const investDate of investmentDates) {
      const price = getPrice(investDate);
      if (price > 0) {
        const shares = new Decimal(settings.amountPerInvestment).div(price);
        totalShares = totalShares.plus(shares);
        totalInvested = totalInvested.plus(settings.amountPerInvestment);
      }
    }

    // Calculate daily returns for chart
    for (const price of prices) {
      const currentValue = totalShares.times(price.close);
      const pnl = currentValue.minus(totalInvested);
      const returnPct = totalInvested.isZero()
        ? 0
        : pnl.div(totalInvested).toNumber();

      dailyReturns.push({
        date: price.date,
        cumulativeReturn: returnPct,
      });
    }

    // Calculate final values
    const lastPrice = prices[prices.length - 1]?.close || 0;
    const finalValue = totalShares.times(lastPrice).toNumber();
    const totalReturn = totalInvested.isZero()
      ? 0
      : new Decimal(finalValue)
          .minus(totalInvested)
          .div(totalInvested)
          .toNumber();

    return {
      symbol,
      totalInvested: totalInvested.toNumber(),
      finalValue,
      totalReturn,
      dailyReturns,
    };
  }

  /**
   * Generate DCA investment dates based on frequency.
   */
  private generateDCADates(
    startDate: string,
    endDate: string,
    frequency: DCAFrequency
  ): string[] {
    const dates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    let current = new Date(start);

    // Interval in days
    const intervalDays =
      frequency === 'weekly' ? 7 : frequency === 'biweekly' ? 14 : 30;

    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]!);
      current.setDate(current.getDate() + intervalDays);
    }

    return dates;
  }
}

export const benchmarkService = new BenchmarkService();
