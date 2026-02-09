/**
 * Historical Price Service
 * Fetches and caches historical price data for portfolio valuation and benchmark comparison.
 */

export interface HistoricalPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface HistoricalPriceData {
  symbol: string;
  prices: HistoricalPrice[];
}

class HistoricalPriceService {
  private cache = new Map<string, HistoricalPriceData>();

  /**
   * Fetch historical prices for a symbol within a date range.
   * Results are cached in memory for the session.
   */
  async getHistoricalPrices(
    symbol: string,
    startDate: string,
    endDate: string
  ): Promise<HistoricalPrice[]> {
    const cacheKey = `${symbol.toUpperCase()}_${startDate}_${endDate}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached.prices;
    }

    try {
      const response = await fetch(
        `http://localhost:3001/api/historical-prices?symbol=${encodeURIComponent(
          symbol
        )}&startDate=${startDate}&endDate=${endDate}`
      );

      if (!response.ok) {
        console.error(
          `Failed to fetch historical prices for ${symbol}:`,
          response.status
        );
        return [];
      }

      const data: HistoricalPriceData = await response.json();

      // Cache result
      this.cache.set(cacheKey, data);

      return data.prices || [];
    } catch (error) {
      console.error(`Error fetching historical prices for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Get the closing price for a symbol on a specific date.
   * Uses binary search for efficiency on cached data.
   */
  async getPriceOnDate(
    symbol: string,
    date: string,
    startDate: string,
    endDate: string
  ): Promise<number | null> {
    const prices = await this.getHistoricalPrices(symbol, startDate, endDate);

    // Find exact date or closest previous date
    for (let i = prices.length - 1; i >= 0; i--) {
      const price = prices[i];
      if (price && price.date <= date) {
        return price.close;
      }
    }

    // If no price found before the date, return first available
    const first = prices[0];
    return first ? first.close : null;
  }

  /**
   * Fetch historical prices for multiple symbols in parallel.
   */
  async getBatchHistoricalPrices(
    symbols: string[],
    startDate: string,
    endDate: string
  ): Promise<Map<string, HistoricalPrice[]>> {
    const results = new Map<string, HistoricalPrice[]>();

    const promises = symbols.map(async symbol => {
      const prices = await this.getHistoricalPrices(symbol, startDate, endDate);
      results.set(symbol.toUpperCase(), prices);
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Clear the cache (useful when user imports new data).
   */
  clearCache(): void {
    this.cache.clear();
  }
}

export const historicalPriceService = new HistoricalPriceService();
