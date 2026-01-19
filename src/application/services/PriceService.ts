// Restored PriceService
// Interfaces defined inline to avoid dependency issues during recovery
import { db } from '@infrastructure/storage/database';

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
  // In-memory L1 cache to avoid hitting DuckDB for every single render
  private memoryCache = new Map<string, PriceCache>();
  private initialized = false;

  constructor() {
    this.init();
  }

  private async init() {
    if (this.initialized) return;
    try {
      // Preload current cache from DB
      await db.createSchema(); // Ensure schema exists (idempotent)
      const rows = await db.query<{
        symbol: string;
        price: number;
        change: number;
        change_percent: number;
        updated_at: number;
        quote_type: string;
      }>('SELECT * FROM prices');

      for (const row of rows) {
        this.memoryCache.set(row.symbol, {
          price: row.price,
          change: row.change,
          changePercent: row.change_percent,
          // Convert BigInt to Number to avoid type mismatch with Date.now()
          timestamp:
            typeof row.updated_at === 'bigint'
              ? Number(row.updated_at)
              : row.updated_at,
          quoteType: row.quote_type,
        });
      }
      this.initialized = true;
    } catch (error) {
      console.warn('PriceService init failed (DB might not be ready):', error);
    }
  }

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

    // Ensure initialized
    if (!this.initialized && uniqueSymbols.length > 0) {
      await this.init();
    }

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
    // console.log(`🔌 Fetching prices for: ${toFetch.join(', ')}`);

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

    // Explicit checkpoint after batch fetch to ensure prices.parquet is updated on server
    if (reallyNewSymbols.length > 0) {
      db.checkpoint().catch(console.error);
    }

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

  private async fetchQuotes(symbols: string[]): Promise<QuoteResponse[]> {
    if (symbols.length === 0) return [];

    try {
      const response = await fetch(
        `http://localhost:3001/api/quotes?symbols=${symbols.join(',')}`
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const results = data.quoteResponse?.result || [];

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

  private async setCache(symbol: string, quote: QuoteResponse): Promise<void> {
    const normalizedSymbol = symbol.toUpperCase();

    // Update Memory Cache
    this.memoryCache.set(normalizedSymbol, {
      price: quote.regularMarketPrice,
      change: quote.regularMarketChange,
      changePercent: quote.regularMarketChangePercent,
      timestamp: Date.now(),
      quoteType: quote.quoteType,
    });

    // Update DB
    try {
      await db.run(
        `INSERT OR REPLACE INTO prices (symbol, price, change, change_percent, updated_at, quote_type)
             VALUES (?, ?, ?, ?, ?, ?)`,
        [
          normalizedSymbol,
          quote.regularMarketPrice,
          quote.regularMarketChange,
          quote.regularMarketChangePercent,
          Date.now(),
          quote.quoteType || 'EQUITY',
        ]
      );
    } catch (e) {
      console.error('Failed to save price to DB', e);
    }
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
    await db.run('DELETE FROM prices');
    await db.checkpoint();
    console.log('🧹 Price cache cleared');
  }
}

export const priceService = new PriceService();
