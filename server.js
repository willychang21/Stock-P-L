/**
 * Stock Portfolio Tracker - Backend Server
 *
 * Responsibilities:
 * 1. Persistent Storage (File-based Parquet for DuckDB)
 * 2. Market Data Proxy (Yahoo Finance)
 * 3. Caching Layer
 */

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import YahooFinance from 'yahoo-finance2';

// --- Configuration ---
const PORT = 3001;
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 Hours
const DATA_DIR = path.join(process.cwd(), 'data');
const CACHE_FILE = path.join(DATA_DIR, 'price_cache.json');

// --- Initialization ---
const app = express();
const yahooFinance = new YahooFinance();

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log(`📂 Created data directory at: ${DATA_DIR}`);
}

// In-memory cache
let priceCache = new Map();
loadCache();

// --- Middleware ---
// --- Middleware ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use((req, res, next) => {
  console.log(`➡️ ${req.method} ${req.url}`);
  next();
});

// Configure Multer for temp uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, DATA_DIR),
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, file.fieldname + '-' + uniqueSuffix + '.tmp');
    },
  }),
});

// --- Routes: Storage (Persistence) ---

/**
 * POST /api/storage/:table
 * Uploads (overwrites) a parquet file for a specific table.
 * Using POST for compatibility with simple upload logic.
 */
app.post('/api/storage/:table', upload.single('file'), (req, res) => {
  const tableName = req.params.table;
  const ALLOWED_TABLES = ['transactions', 'import_batches', 'prices'];

  // 1. Validation
  if (!ALLOWED_TABLES.includes(tableName)) {
    cleanupTempFile(req.file);
    return res.status(400).json({ error: `Invalid table: ${tableName}` });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // 2. Persistence
  try {
    const finalPath = path.join(DATA_DIR, `${tableName}.parquet`);

    // Windows/OS lock safety
    try {
      if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
    } catch (e) {
      console.warn('Could not unlink old file', e);
    }

    // Move temp file to final destination
    fs.renameSync(req.file.path, finalPath);

    console.log(
      `💾 [Storage] Saved ${tableName}.parquet (${req.file.size} bytes)`
    );
    res.json({ success: true, size: req.file.size, path: finalPath });
  } catch (error) {
    cleanupTempFile(req.file);
    console.error(`❌ [Storage] Failed to save ${tableName}:`, error);
    res.status(500).json({ error: 'Internal Server Error during file save' });
  }
});

/**
 * GET /api/storage/:table
 * Retrieves the parquet file.
 */
app.get('/api/storage/:table', (req, res) => {
  const tableName = req.params.table;
  const filePath = path.join(DATA_DIR, `${tableName}.parquet`);

  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    // If empty (0 bytes), treat as not found to trigger fresh init
    if (stats.size === 0) {
      return res.status(404).json({ error: 'Storage file is empty' });
    }
    // console.log(`📤 [Storage] Serving ${tableName}.parquet`);
    res.download(filePath);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

/**
 * DELETE /api/storage/clear
 * Resets the database.
 */
app.delete('/api/storage/clear', (req, res) => {
  try {
    ['transactions', 'import_batches', 'prices'].forEach(table => {
      const p = path.join(DATA_DIR, `${table}.parquet`);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });
    console.log('🗑️ [Storage] Database cleared');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear storage' });
  }
});

// --- Routes: Market Data (Quotes) ---

/**
 * GET /api/quotes
 * Fetches real-time market data.
 * Query: ?symbols=AAPL,TSLA
 */
app.get('/api/quotes', async (req, res) => {
  const { symbols } = req.query;

  if (!symbols || typeof symbols !== 'string') {
    return res
      .status(400)
      .json({ error: 'Invalid or missing "symbols" parameter' });
  }

  const symbolList = symbols
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(s => s.length > 0);

  if (symbolList.length === 0) {
    return res.json({ quoteResponse: { result: [], error: null } });
  }

  console.log(`🔌 [Quotes] Request: ${symbolList.join(', ')}`);

  try {
    const quotes = await fetchQuotesWithCache(symbolList);
    res.json({
      quoteResponse: {
        result: quotes,
        error: null,
      },
    });
  } catch (error) {
    console.error('❌ [Quotes] Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch quotes' });
  }
});

// Historical Cache (In-Memory)
const historicalCache = new Map();

/**
 * GET /api/historical-prices
 * Fetches historical price data for a symbol.
 * Query: ?symbol=AAPL&startDate=2025-01-01&endDate=2026-01-19
 * Returns: { symbol, prices: [{ date, open, high, low, close, volume }] }
 */
app.get('/api/historical-prices', async (req, res) => {
  const { symbol, startDate, endDate } = req.query;

  if (!symbol || typeof symbol !== 'string') {
    return res
      .status(400)
      .json({ error: 'Missing or invalid "symbol" parameter' });
  }

  if (!startDate || !endDate) {
    return res
      .status(400)
      .json({ error: 'Missing "startDate" or "endDate" parameters' });
  }

  // Create a cache key based on symbol and dates
  const cacheKey = `${symbol.toUpperCase()}-${startDate}-${endDate}`;

  // Check Cache
  if (historicalCache.has(cacheKey)) {
    // console.log(`📦 [Historical] Serving from cache: ${symbol}`);
    return res.json(historicalCache.get(cacheKey));
  }

  console.log(
    `📈 [Historical] Request: ${symbol} from ${startDate} to ${endDate}`
  );

  try {
    const queryOptions = {
      period1: new Date(startDate),
      period2: new Date(endDate),
      interval: '1d',
    };

    // Normalize symbol (e.g., BRKB -> BRK-B)
    const normalizedSymbol = normalizeSymbol(symbol.toUpperCase());

    // Add a small random delay to spread out requests (Rate Limiting mitigation)
    // await new Promise(resolve => setTimeout(resolve, Math.random() * 200));

    const result = await yahooFinance.chart(normalizedSymbol, queryOptions);

    if (!result || !result.quotes || result.quotes.length === 0) {
      return res.status(404).json({ error: 'No historical data found' });
    }

    const prices = result.quotes
      .filter(q => q.close !== null && q.close !== undefined)
      .map(q => ({
        date: q.date.toISOString().split('T')[0],
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.close,
        volume: q.volume,
      }));

    console.log(
      `📈 [Historical] Returned ${prices.length} data points for ${symbol}`
    );

    const responsePayload = {
      symbol: symbol.toUpperCase(),
      prices,
    };

    // Store in Cache (TTL could be added, but mostly harmless for daily data)
    historicalCache.set(cacheKey, responsePayload);

    res.json(responsePayload);
  } catch (error) {
    console.error(`❌ [Historical] Error fetching ${symbol}:`, error.message);
    res.status(500).json({ error: 'Failed to fetch historical prices' });
  }
});

// --- Routes: Legacy/Debug ---

app.get('/api/cache/legacy', (req, res) => {
  const entries = Array.from(priceCache.entries()).map(([symbol, data]) => ({
    symbol,
    regularMarketPrice: data.price,
    quoteType: data.quoteType,
    updatedAt: data.timestamp,
  }));
  res.json(entries);
});

// --- Helper Functions ---

function normalizeSymbol(symbol) {
  // Yahoo Finance mapping overrides
  const MAPPINGS = {
    BRKB: 'BRK-B',
    'BRK.B': 'BRK-B',
  };
  return MAPPINGS[symbol] || symbol;
}

async function fetchQuotesWithCache(symbols) {
  const results = [];
  const missing = [];

  // 1. Check Cache
  for (const sym of symbols) {
    const cached = priceCache.get(sym);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      results.push(formatQuote(sym, cached.price, cached.quoteType));
    } else {
      missing.push(sym);
    }
  }

  // 2. Fetch Missing from Provider
  if (missing.length > 0) {
    // console.log(`🌍 [Quotes] Fetching from upstream: ${missing.length} symbols`);
    try {
      const apiResults = await yahooFinance.quote(missing, { return: 'array' });
      const apiArray = Array.isArray(apiResults) ? apiResults : [apiResults];

      for (const q of apiArray) {
        if (!q) continue;
        const sym = q.symbol.toUpperCase(); // Yahoo might return different case

        // Cache it
        priceCache.set(sym, {
          price: q.regularMarketPrice,
          quoteType: q.quoteType || 'EQUITY',
          timestamp: Date.now(),
        });

        results.push(
          formatQuote(sym, q.regularMarketPrice, q.quoteType || 'EQUITY')
        );
      }

      saveCache(); // Persist cache
    } catch (e) {
      console.error('⚠️ [Quotes] Upstream fetch failed:', e.message);
      // Fallback: Return stale cache if available for 'missing' items
      for (const sym of missing) {
        const stale = priceCache.get(sym);
        if (stale) {
          results.push(formatQuote(sym, stale.price, stale.quoteType));
        }
      }
    }
  }

  return results;
}

function formatQuote(symbol, price, quoteType) {
  return {
    symbol,
    regularMarketPrice: price,
    quoteType,
    regularMarketChange: 0,
    regularMarketChangePercent: 0,
    currency: 'USD',
  };
}

function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      priceCache = new Map(data);
      console.log(`📦 [Cache] Loaded ${priceCache.size} entries`);
    }
  } catch (e) {
    console.warn('⚠️ [Cache] Failed to load cache file, starting fresh.');
  }
}

function saveCache() {
  try {
    const data = JSON.stringify(Array.from(priceCache.entries()));
    fs.writeFileSync(CACHE_FILE, data);
  } catch (e) {
    console.error('⚠️ [Cache] Failed to save cache:', e.message);
  }
}

function cleanupTempFile(file) {
  if (file && file.path && fs.existsSync(file.path)) {
    fs.unlinkSync(file.path);
  }
}

// --- Start Server ---
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`   - Storage: ${DATA_DIR}`);
});

// Prevent crashes
process.on('uncaughtException', err => {
  console.error('💥 Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection:', reason);
});
