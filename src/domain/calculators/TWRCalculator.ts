/**
 * Time-Weighted Return (TWR) Calculator
 *
 * Implements the GIPS-compliant TWR calculation that eliminates
 * the impact of cash flows to give a fair comparison with benchmarks.
 */

import Decimal from 'decimal.js';
import { DailyPortfolioValue } from './PortfolioValueCalculator';

export interface PeriodReturn {
  startDate: string;
  endDate: string;
  startValue: Decimal;
  endValue: Decimal;
  cashFlow: Decimal;
  periodReturn: number; // Decimal return for this sub-period
}

export interface TWRResult {
  twr: number; // e.g., 0.352 = 35.2%
  periodReturns: PeriodReturn[];
  startDate: string;
  endDate: string;
}

export class TWRCalculator {
  /**
   * Calculate Time-Weighted Return using Modified Dietz method for sub-periods.
   *
   * TWR = [(1 + R1) × (1 + R2) × ... × (1 + Rn)] - 1
   *
   * Where each Ri is the return for a sub-period between cash flows:
   * Ri = (EndValue / (StartValue + CashFlow)) - 1
   */
  calculate(dailyValues: DailyPortfolioValue[]): TWRResult {
    if (dailyValues.length === 0) {
      return {
        twr: 0,
        periodReturns: [],
        startDate: '',
        endDate: '',
      };
    }

    const firstVal = dailyValues[0];
    const lastVal = dailyValues[dailyValues.length - 1];

    if (!firstVal || !lastVal) {
      return {
        twr: 0,
        periodReturns: [],
        startDate: '',
        endDate: '',
      };
    }

    if (dailyValues.length === 1) {
      return {
        twr: 0,
        periodReturns: [],
        startDate: firstVal.date,
        endDate: firstVal.date,
      };
    }

    const periodReturns: PeriodReturn[] = [];
    let cumulativeReturn = new Decimal(1);

    for (let i = 1; i < dailyValues.length; i++) {
      const prev = dailyValues[i - 1];
      const curr = dailyValues[i];

      if (!prev || !curr) continue;

      // Start value is the market value at end of previous period
      // Plus any cash flow that happened at the start of this period
      const startValue = prev.marketValue;
      const endValue = curr.marketValue;
      const cashFlow = curr.cashFlow;

      // Calculate sub-period return
      // Using simplified approach: R = (V1 - V0 - CF) / (V0 + CF * 0.5)
      // This is the Modified Dietz method approximation
      const denominator = startValue.plus(cashFlow.times(0.5));

      let periodReturn = new Decimal(0);
      if (!denominator.isZero() && !startValue.isZero()) {
        periodReturn = endValue
          .minus(startValue)
          .minus(cashFlow)
          .div(denominator);
      }

      periodReturns.push({
        startDate: prev.date,
        endDate: curr.date,
        startValue,
        endValue,
        cashFlow,
        periodReturn: periodReturn.toNumber(),
      });

      // Accumulate return
      cumulativeReturn = cumulativeReturn.times(
        new Decimal(1).plus(periodReturn)
      );
    }

    // TWR = cumulative - 1
    const twr = cumulativeReturn.minus(1).toNumber();

    return {
      twr,
      periodReturns,
      startDate: firstVal.date,
      endDate: lastVal.date,
    };
  }

  /**
   * Calculate simple return for comparison.
   * Simple Return = (End Value + Realized P/L - Total Invested) / Total Invested
   */
  calculateSimpleReturn(
    currentValue: Decimal,
    totalInvested: Decimal,
    realizedPL: Decimal
  ): number {
    if (totalInvested.isZero()) return 0;

    const totalReturn = currentValue.plus(realizedPL).minus(totalInvested);
    return totalReturn.div(totalInvested).toNumber();
  }
}

export const twrCalculator = new TWRCalculator();
