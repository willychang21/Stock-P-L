import Decimal from 'decimal.js';

// Mock interfaces to avoid importing complex dependencies
interface DailyPortfolioValue {
  date: string;
  marketValue: Decimal;
  cashFlow: Decimal;
  costBasis: Decimal;
  realizedPL: Decimal;
}

async function runDebug() {
  console.log('🔍 Starting Benchmark Debug Logic Check...');

  // Simulate the suspected data scenario
  // Hypothesis:
  // Day 1: User buys TSLA $1000. Price fetch fails (MV=0). NetInv = 1000. GrossInv = 1000.
  // Day 2: User sells TSLA $1000 (at cost). NetInv = 0. GrossInv = 1000.

  const mockData: DailyPortfolioValue[] = [
    {
      date: '2026-01-10',
      marketValue: new Decimal(0), // Price missing!
      cashFlow: new Decimal(1000), // Buy
      costBasis: new Decimal(1000),
      realizedPL: new Decimal(0),
    },
    {
      date: '2026-01-11',
      marketValue: new Decimal(0), // Still missing
      cashFlow: new Decimal(0),
      costBasis: new Decimal(1000),
      realizedPL: new Decimal(0),
    },
    {
      date: '2026-01-12',
      marketValue: new Decimal(0),
      cashFlow: new Decimal(-1000), // Sell (Get cash back)
      costBasis: new Decimal(0),
      realizedPL: new Decimal(0),
    },
  ];

  console.log('--- SIMULATION ---');
  let netInvested = new Decimal(0);
  let grossInvested = new Decimal(0);

  for (const val of mockData) {
    netInvested = netInvested.plus(val.cashFlow);
    if (val.cashFlow.isPositive()) {
      grossInvested = grossInvested.plus(val.cashFlow);
    }

    let cumulativeReturn = 0;
    // Total PL = MarketValue - NetInvested
    const totalPL = val.marketValue.minus(netInvested);

    if (!grossInvested.isZero()) {
      cumulativeReturn = totalPL.div(grossInvested).toNumber();
    }

    console.log(`Date: ${val.date}`);
    console.log(`  CF: ${val.cashFlow}`);
    console.log(`  MV: ${val.marketValue}`);
    console.log(`  NetInv: ${netInvested}`);
    console.log(`  GrossInv: ${grossInvested}`);
    console.log(`  TotalPL: ${totalPL} (MV - NetInv)`);
    console.log(`  Return: ${(cumulativeReturn * 100).toFixed(2)}%`);
    console.log('---');
  }
}

runDebug();
