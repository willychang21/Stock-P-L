import * as duckdb from '@duckdb/duckdb-wasm';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import duckdb_wasm_next from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import duckdb_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import duckdb_worker_next from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';

/**
 * DuckDB database singleton wrapper
 * Handles initialization, server sync, and provides query helpers
 */
class DatabaseService {
  private db: duckdb.AsyncDuckDB | null = null;
  private conn: duckdb.AsyncDuckDBConnection | null = null;

  private initPromise: Promise<void> | null = null;
  private readonly SERVER_URL_BASE = 'http://127.0.0.1:3001/api/storage';

  private async saveTable(tableName: string) {
    console.log(`💾 [${tableName}] Starting saveTable...`);
    if (!this.conn || !this.db) {
      console.error(`❌ [${tableName}] DB Connection missing!`);
      return;
    }
    try {
      // Debug: Check records first
      const countResult = await this.conn.query(
        `SELECT count(*) as c FROM ${tableName}`
      );
      const count = Number(countResult.toArray()[0].toJSON().c);
      console.log(`📊 [${tableName}] Row count in DB: ${count}`);

      if (count === 0) {
        console.warn(
          `⚠️ [${tableName}] Table is empty, skipping upload to save bandwidth.`
        );
        // We might still want to upload empty file to clear server?
        // For now let's proceed to ensure server state matches client state (empty)
      }

      // Export to Parquet in virtual FS
      const fileName = `export_${tableName}.parquet`;
      console.log(`🔨 [${tableName}] Exporting to virtual file: ${fileName}`);

      await this.conn.query(
        `COPY ${tableName} TO '${fileName}' (FORMAT PARQUET)`
      );

      console.log(`📋 [${tableName}] Reading buffer from virtual file...`);
      const buffer = await this.db.copyFileToBuffer(fileName);
      console.log(
        `📦 [${tableName}] Generated Parquet Buffer Size: ${buffer.length} bytes`
      );

      if (buffer.length === 0) {
        console.error(`❌ [${tableName}] Generated empty parquet file!`);
        return;
      }

      // Upload
      console.log(
        `🚀 [${tableName}] Uploading to ${this.SERVER_URL_BASE}/${tableName}...`
      );
      const formData = new FormData();
      formData.append(
        'file',
        new Blob([buffer as any]),
        `${tableName}.parquet`
      );

      const res = await fetch(`${this.SERVER_URL_BASE}/${tableName}`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        console.error(
          `❌ [${tableName}] Upload failed: ${res.status} ${res.statusText}`
        );
        const text = await res.text();
        console.error('Server response:', text);
      } else {
        const json = await res.json();
        console.log(`✅ [${tableName}] Upload success:`, json);
      }

      // Cleanup
      try {
        await this.db.registerFileBuffer(fileName, new Uint8Array(0));
      } catch (e) {
        /*ignore*/
      }
    } catch (e) {
      console.error(`❌ Failed to save ${tableName}:`, e);
    }
  }

  /**
   * Initialize the database (internal in-memory only, populated from server)
   */
  async initialize(): Promise<void> {
    if (this.db) return;

    window.addEventListener('beforeunload', () => {
      this.db?.terminate();
    });

    if (this.initPromise) return this.initPromise;

    this.initPromise = this._initCore().catch(err => {
      this.initPromise = null;
      throw err;
    });

    return this.initPromise;
  }

  private async _initCore(): Promise<void> {
    const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
      mvp: {
        mainModule: duckdb_wasm,
        mainWorker: duckdb_worker,
      },
      eh: {
        mainModule: duckdb_wasm_next,
        mainWorker: duckdb_worker_next,
      },
    };

    const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
    const worker = new Worker(bundle.mainWorker!);
    const logger = new duckdb.ConsoleLogger();

    this.db = new duckdb.AsyncDuckDB(logger, worker);
    await this.db.instantiate(bundle.mainModule, bundle.pthreadWorker);

    await this.connect();
    await this.createSchema();

    // Load data from server
    await this.loadFromServer('transactions');
    await this.loadFromServer('import_batches');
    await this.loadFromServer('prices');

    console.log('🦆 DuckDB Initialized (Server-Synced Mode)');
  }

  private async loadFromServer(tableName: string): Promise<void> {
    if (!this.conn || !this.db) return;

    try {
      console.log(`📥 Loading ${tableName} from server...`);
      // Add timestamp to prevent caching of old/empty files
      const res = await fetch(
        `${this.SERVER_URL_BASE}/${tableName}?t=${Date.now()}`
      );
      if (!res.ok) {
        if (res.status === 404) {
          console.log(`ℹ️ No server data for ${tableName} (Fresh start)`);
          return;
        }
        throw new Error(`Fetch failed: ${res.status}`);
      }

      const buffer = await res.arrayBuffer();
      const tempFileName = `load_${tableName}.parquet`;

      await this.db.registerFileBuffer(tempFileName, new Uint8Array(buffer));

      // Bulk insert from parquet
      // For transactions table, we have both PK(id) and UNIQUE(content_hash).
      // INSERT OR REPLACE fails because it's ambiguous which constraint to target for conflict resolution.
      // Since this is a full load from server (authoritative source), we clear local table first.
      await this.conn.query(`DELETE FROM ${tableName}`);
      await this.conn.query(
        `INSERT INTO ${tableName} SELECT * FROM '${tempFileName}'`
      );

      // Cleanup
      await this.db.registerFileBuffer(tempFileName, new Uint8Array(0));

      console.log(`✅ Loaded ${tableName}`);
    } catch (e) {
      console.warn(`Failed to load ${tableName} from server:`, e);
    }
  }

  /**
   * Checkpoint: Uploads all tables to server
   */
  /**
   * Checkpoint: Uploads all tables to server
   * @param force - If true, bypasses cooldown and waits for completion
   */

  private lastCheckpoint = 0;
  private readonly CHECKPOINT_COOLDOWN_MS = 5000; // 5 seconds debounce

  async checkpoint(force = false): Promise<void> {
    await this.initialize(); // Ensure DB is fully loaded before saving

    const now = Date.now();
    if (!force && now - this.lastCheckpoint < this.CHECKPOINT_COOLDOWN_MS) {
      this.queueBackup();
      return;
    }

    this.lastCheckpoint = now;
    console.log(`💾 Triggering Server Sync... (Force: ${force})`);

    // If forced, we await the upload to ensure data persistence
    if (force) {
      await this.uploadAllTables();
    } else {
      // Fire and forget for background syncs
      this.uploadAllTables();
    }
  }

  private backupTimeout: any = null;
  private queueBackup() {
    if (this.backupTimeout) clearTimeout(this.backupTimeout);
    this.backupTimeout = setTimeout(() => {
      this.uploadAllTables();
      this.lastCheckpoint = Date.now();
    }, this.CHECKPOINT_COOLDOWN_MS);
  }

  private async uploadAllTables() {
    // initialize() is awaited in checkpoint, but queueBackup calls this directly?
    // queueBackup is called by checkpoint, which awaited initialize.
    // However, setTimeout callback doesn't carry the await context if initialize was pending?
    // Actually checkpoint awaits initialize BEFORE queuing. So by the time queueBackup runs, it's init-ed.
    // Double check: if multiple checkpoint calls queue and clear timeout.

    await Promise.all([
      this.saveTable('transactions'),
      this.saveTable('import_batches'),
      this.saveTable('prices'),
    ]);
    console.log('✅ Server Sync Complete');
  }

  async connect(): Promise<void> {
    if (!this.db) throw new Error('DB not initialized');
    this.conn = await this.db.connect();
  }

  async clear(): Promise<void> {
    if (!this.conn) return;
    console.log('🗑️ Clearing database...');

    await this.conn.query('DELETE FROM transactions');
    await this.conn.query('DELETE FROM import_batches');
    await this.conn.query('DELETE FROM prices');

    // Clear server
    await fetch(`${this.SERVER_URL_BASE}/clear`, { method: 'DELETE' });
    console.log('✅ Database cleared');
  }

  async createSchema(): Promise<void> {
    if (!this.conn) throw new Error('Database not connected');

    await this.conn.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        import_batch_id TEXT NOT NULL,
        symbol TEXT NOT NULL,
        transaction_type TEXT NOT NULL,
        transaction_date TEXT NOT NULL,
        settle_date TEXT,
        quantity TEXT NOT NULL,
        price TEXT NOT NULL,
        fees TEXT NOT NULL,
        total_amount TEXT NOT NULL,
        broker TEXT NOT NULL,
        account_id TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        raw_data TEXT NOT NULL,
        content_hash TEXT NOT NULL UNIQUE
      );
      CREATE INDEX IF NOT EXISTS idx_symbol_date ON transactions(symbol, transaction_date);

      CREATE TABLE IF NOT EXISTS import_batches (
        id TEXT PRIMARY KEY,
        broker TEXT NOT NULL,
        filename TEXT NOT NULL,
        imported_at TEXT NOT NULL,
        row_count INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS prices (
        symbol TEXT PRIMARY KEY,
        price DOUBLE NOT NULL,
        change DOUBLE NOT NULL,
        change_percent DOUBLE NOT NULL,
        updated_at BIGINT NOT NULL,
        quote_type TEXT
      );
    `);
  }

  async bulkInsert(tableName: string, data: any[]): Promise<void> {
    if (!this.conn || !this.db) throw new Error('Database not connected');
    if (data.length === 0) return;

    const tempFileName = `import_${Date.now()}_${Math.random().toString(36).substring(7)}.json`;
    const jsonContent = JSON.stringify(data);

    try {
      await this.db.registerFileText(tempFileName, jsonContent);
      await this.conn.query(
        `INSERT OR IGNORE INTO ${tableName} SELECT * FROM read_json_auto('${tempFileName}')`
      );
    } finally {
      try {
        await this.db.registerFileText(tempFileName, '');
      } catch (e) {
        console.warn('Failed to cleanup temp import file', e);
      }
    }
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.conn) throw new Error('Database not connected');
    const stmt = await this.conn.prepare(sql);
    const result = await stmt.query(...params);
    const rows = result.toArray().map(row => row.toJSON());
    await stmt.close();
    return rows as T[];
  }

  async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const results = await this.query<T>(sql, params);
    return results[0] || null;
  }

  async run(sql: string, params: any[] = []): Promise<void> {
    if (!this.conn) throw new Error('Database not connected');
    const stmt = await this.conn.prepare(sql);
    if (params.length > 0) {
      await stmt.query(...params);
    } else {
      await stmt.query();
    }
    await stmt.close();
  }

  async transaction(fn: () => Promise<void>): Promise<void> {
    if (!this.conn) throw new Error('Database not connected');
    await this.run('BEGIN TRANSACTION');
    try {
      await fn();
      await this.run('COMMIT');
    } catch (error) {
      await this.run('ROLLBACK');
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.conn) {
      await this.conn.close();
      this.conn = null;
    }
    if (this.db) {
      await this.db.terminate();
      this.db = null;
    }
  }
}

export const db = new DatabaseService();

if (import.meta.hot) {
  import.meta.hot.dispose(async () => {
    console.log('🔥 HMR: Disposing DatabaseService...');
    await db.close();
  });
}
