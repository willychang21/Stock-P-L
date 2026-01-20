import { portfolioValueCalculator } from '../src/domain/calculators/PortfolioValueCalculator';
import Decimal from 'decimal.js';

async function traceChartLogic() {
  console.log('🕵️‍♀️ Starting Real Data Trace...');

  try {
    // Ensure DB is initialized (if needed, though services usually handle it)
    // We might need to wait a sec or mock the repository if it relies on a running server,
    // but usually it reads directly from parquet/duckdb.
    // If it relies on 'process.cwd()' being root.

    const today = new Date().toISOString().split('T')[0];
    const dailyValues =
      await portfolioValueCalculator.calculateDailyValues(today);

    if (dailyValues.length === 0) {
      console.log('⚠️ No daily values returned.');
      return;
    }

    console.log(
      `📅 analysis range: ${dailyValues[0].date} to ${dailyValues[dailyValues.length - 1].date}`
    );
    console.log(
      '---------------------------------------------------------------------------------------------------'
    );
    console.log(
      'Date       |   CashFlow | NetInvested | GrossInvested | MarketValue |    TotalPL | ChartReturn %'
    );
    console.log(
      '---------------------------------------------------------------------------------------------------'
    );

    let netInvested = new Decimal(0);
    let grossInvested = new Decimal(0);

    for (const val of dailyValues) {
      netInvested = netInvested.plus(val.cashFlow);

      if (val.cashFlow.isPositive()) {
        grossInvested = grossInvested.plus(val.cashFlow);
      }

      let cumulativeReturn = 0;
      let totalPL = new Decimal(0);

      if (!grossInvested.isZero()) {
        totalPL = val.marketValue.minus(netInvested);
        cumulativeReturn = totalPL.div(grossInvested).toNumber();
      }

      // Filter: Print start, end, and big jumps or high CF
      const isStart = val === dailyValues[0];
      const isEnd = val === dailyValues[dailyValues.length - 1];
      const hasLargeCF = val.cashFlow.abs().gt(100);
      const isOutlier = cumulativeReturn > 0.5 || cumulativeReturn < -0.5;

      if (true) {
        // Print ALL for now to capture the spike transition
        const dateStr = val.date;
        const cfStr = val.cashFlow.toFixed(0).padStart(10);
        const netStr = netInvested.toFixed(0).padStart(11);
        const grossStr = grossInvested.toFixed(0).padStart(13);
        const mvStr = val.marketValue.toFixed(0).padStart(11);
        const plStr = totalPL.toFixed(0).padStart(10);
        const retStr = (cumulativeReturn * 100).toFixed(2).padStart(11);

        console.log(
          `${dateStr} | ${cfStr} | ${netStr} | ${grossStr} | ${mvStr} | ${plStr} | ${retStr}%`
        );
      }
    }
  } catch (e) {
    console.error('Trace Failed:', e);
  }
}

traceChartLogic();
