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
    const holdings = await plService.getAllHoldings();
    let currentValue = new Decimal(0);
    let totalCostBasis = new Decimal(0);
    let unrealizedPL = new Decimal(0);

    for (const holding of holdings.values()) {
      currentValue = currentValue.plus(holding.market_value || 0);
      totalCostBasis = totalCostBasis.plus(holding.cost_basis || 0);
      unrealizedPL = unrealizedPL.plus(holding.unrealized_pl || 0);
    }

    const perfReport = await plService.getTradePerformance();
    const realizedPL = perfReport.overall.totalRealized;

    // Total P/L = Unrealized + Realized
    const totalPL = unrealizedPL.plus(realizedPL);

    // Simple Return = Total P/L / Total Cost Basis of current holdings
    // This isn't perfectly accurate for simple return but gives a reasonable estimate
    const simpleReturn = totalCostBasis.isZero()
      ? 0
      : totalPL.div(totalCostBasis).toNumber();

    // 4. Calculate portfolio daily cumulative returns for chart
    const portfolioDailyReturns =
      this.calculateDailyCumulativeReturns(dailyValues);

    // Use simpleReturn as the displayed TWR since the period-by-period
    // TWR calculation gives unrealistic results with frequent trades.
    // This is a known limitation when cash flows are large relative to portfolio size.
    const portfolioTWR = simpleReturn;

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

    // Use Return on Gross Invested Capital (Total PL / Total Capital Deployed)
    // This provides a stable performance view that doesn't spike on withdrawals
    const returns: DailyReturn[] = [];

    let netInvested = new Decimal(0);
    let grossInvested = new Decimal(0);

    // Iterate ALL values to build cumulative history from start
    for (const val of values) {
      // Net Invested accumulates all flows (+/-)
      netInvested = netInvested.plus(val.cashFlow);

      // Gross Invested only accumulates inflows (money put to work)
      if (val.cashFlow.isPositive()) {
        grossInvested = grossInvested.plus(val.cashFlow);
      }

      let cumulativeReturn = 0;

      // Calculate return based on Total P/L against Gross Capital Deployed
      // Calculate return based on Total P/L against Gross Capital Deployed
      if (!grossInvested.isZero()) {
        // Alignment Fix: Use the same logic as "Performance Metrics" table.
        // Total PL = (Market Value - Cost Basis) + Realized P/L
        // This ensures the chart matches the table's P/L figure.
        const unrealizedPL = val.marketValue.minus(val.costBasis);
        const totalPL = unrealizedPL.plus(val.realizedPL);

        cumulativeReturn = totalPL.div(grossInvested).toNumber();
      }

      returns.push({
        date: val.date,
        cumulativeReturn,
      });
    }

    return returns;
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
