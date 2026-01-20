import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

async function testFetch() {
  const symbol = 'TSLA';
  const queryOptions = {
    period1: new Date('2025-07-22T07:00:00.000Z'),
    period2: new Date('2026-01-20'),
    interval: '1d',
  };

  console.log(`Testing fetch for ${symbol}... with Date objects`);
  try {
    const result = await yahooFinance.chart(symbol, queryOptions);
    console.log('Success!');
    console.log(`Returned ${result.quotes ? result.quotes.length : 0} quotes.`);
    if (result.quotes && result.quotes.length > 0) {
      console.log('First:', result.quotes[0]);
      console.log('Last:', result.quotes[result.quotes.length - 1]);
    }
  } catch (e) {
    console.error('Fetch Failed:', e);
  }
}

testFetch();
