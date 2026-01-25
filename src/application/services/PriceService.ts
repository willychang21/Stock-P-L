// Restored PriceService
// Interfaces defined inline to avoid dependency issues during recovery
import { apiClient } from '@infrastructure/api/client';

interface QuoteResponse {
  symbol: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketPreviousClose: number;
  shortName?: string;
  currency?: string;
  quoteType?: string;
}

interface PriceCache {
  price: number;
  change: number;
  changePercent: number;
  timestamp: number;
  quoteType?: string;
}

const CACHE_DURATION_MS = 12 * 60 * 60 * 1000; // Increased to 12 hours

export class PriceService {
  // In-memory L1 cache to avoid hitting Backend for every single render
  private memoryCache = new Map<string, PriceCache>();

  getAssetType(symbol: string): string {
    const cached = this.memoryCache.get(symbol.toUpperCase());
    return cached?.quoteType || 'EQUITY';
  }

  private pendingRequests = new Map<string, Promise<QuoteResponse[]>>();

  async getPrices(symbols: string[]): Promise<Map<string, number>> {
    const prices = new Map<string, number>();
    const uniqueSymbols = Array.from(
      new Set(symbols.map(s => s.toUpperCase()))
    );
    const toFetch: string[] = [];

    // 1. Check Cache
    for (const symbol of uniqueSymbols) {
      const cached = this.getCached(symbol);
      if (cached) {
        prices.set(symbol, cached.price);
      } else {
        toFetch.push(symbol);
      }
    }

    if (toFetch.length === 0) {
      return prices;
    }

    // 2. Fetch Missing (Deduplicated) and Stale
    const reallyNewSymbols: string[] = [];
    const pendingPromises: Promise<QuoteResponse[]>[] = [];

    for (const symbol of toFetch) {
      if (this.pendingRequests.has(symbol)) {
        pendingPromises.push(this.pendingRequests.get(symbol)!);
      } else {
        reallyNewSymbols.push(symbol);
      }
    }

    if (reallyNewSymbols.length > 0) {
      const fetchPromise = this.fetchQuotes(reallyNewSymbols).then(quotes => {
        // Update caches
        for (const quote of quotes) {
          this.setCache(quote.symbol, quote);
        }
        return quotes;
      });

      // Cleanup
      const sharedPromise = fetchPromise.then(quotes => {
        for (const s of reallyNewSymbols) {
          this.pendingRequests.delete(s);
        }
        return quotes;
      });

      for (const s of reallyNewSymbols) {
        this.pendingRequests.set(s, sharedPromise);
      }

      pendingPromises.push(sharedPromise);
    }

    await Promise.all(pendingPromises);

    // 3. Re-read from cache
    for (const symbol of toFetch) {
      const cached = this.memoryCache.get(symbol);
      if (cached) {
        prices.set(symbol, cached.price);
      } else {
        prices.set(symbol, 0);
      }
    }

    return prices;
  }

  async getCurrentPrice(symbol: string): Promise<number | undefined> {
    const prices = await this.getPrices([symbol]);
    return prices.get(symbol);
  }

  private async fetchQuotes(symbols: string[]): Promise<QuoteResponse[]> {
    if (symbols.length === 0) return [];

    try {
      const data = await apiClient.getQuotes(symbols);
      const results = data.result || [];

      if (Array.isArray(results)) {
        return results.map((item: any) => ({
          symbol: item.symbol,
          regularMarketPrice: item.regularMarketPrice,
          regularMarketChange: item.regularMarketChange || 0,
          regularMarketChangePercent: item.regularMarketChangePercent || 0,
          regularMarketPreviousClose: 0,
          quoteType: item.quoteType,
        }));
      }
      return [];
    } catch (error) {
      console.warn('API Fetch Error:', error);
      return [];
    }
  }

  private setCache(symbol: string, quote: QuoteResponse): void {
    const normalizedSymbol = symbol.toUpperCase();

    // Update Memory Cache
    this.memoryCache.set(normalizedSymbol, {
      price: quote.regularMarketPrice,
      change: quote.regularMarketChange,
      changePercent: quote.regularMarketChangePercent,
      timestamp: Date.now(),
      quoteType: quote.quoteType,
    });
  }

  private getCached(symbol: string): PriceCache | null {
    const cached = this.memoryCache.get(symbol.toUpperCase());
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
      return cached;
    }
    return null;
  }

  async clearCache(): Promise<void> {
    this.memoryCache.clear();
    console.log('🧹 Price cache cleared');
  }
}

export const priceService = new PriceService();
