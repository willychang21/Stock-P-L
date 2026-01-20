import { db } from './database';
import {
  Transaction,
  SerializedTransaction,
  serializeTransaction,
  deserializeTransaction,
} from '@domain/models/Transaction';

/**
 * Repository for Transaction CRUD operations
 * Implements content-hash based deduplication strategy
 */
export class TransactionRepository {
  /**
   * Insert a single transaction
   */
  async insert(transaction: Transaction): Promise<void> {
    const serialized = serializeTransaction(transaction);
    const contentHash = this.generateContentHash(transaction);

    await db.run(
      `INSERT INTO transactions (
        id, import_batch_id, symbol, transaction_type, 
        transaction_date, settle_date, quantity, price, fees, total_amount,
        broker, account_id, notes, created_at, raw_data, content_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        serialized.id,
        serialized.import_batch_id,
        serialized.symbol,
        serialized.transaction_type,
        serialized.transaction_date,
        serialized.settle_date,
        serialized.quantity,
        serialized.price,
        serialized.fees,
        serialized.total_amount,
        serialized.broker,
        serialized.account_id || null,
        serialized.notes || null,
        serialized.created_at,
        serialized.raw_data,
        contentHash,
      ]
    );

    await db.checkpoint(true);
  }

  /**
   * Insert multiple transactions in a single transaction
   */
  async insertBatch(transactions: Transaction[]): Promise<number> {
    if (transactions.length === 0) return 0;

    const data = transactions.map(tx => {
      const serialized = serializeTransaction(tx);
      const contentHash = this.generateContentHash(tx);
      return {
        ...serialized,
        account_id: serialized.account_id || null, // Ensure nulls for optional fields
        notes: serialized.notes || null,
        content_hash: contentHash,
      };
    });

    // Use efficient JSON bulk insert
    await db.bulkInsert('transactions', data);

    // Force checkpoint to ensure persistence
    await db.checkpoint(true);

    return transactions.length;
  }

  /**
   * Find all transactions for a symbol, ordered by date
   */
  async findBySymbol(symbol: string): Promise<Transaction[]> {
    const results = await db.query<SerializedTransaction>(
      `SELECT * FROM transactions 
       WHERE symbol = ? 
       ORDER BY transaction_date ASC, id ASC`,
      [symbol]
    );

    return results.map(deserializeTransaction);
  }

  /**
   * Find transactions within a date range
   */
  async findByDateRange(
    startDate: string,
    endDate: string,
    symbol?: string
  ): Promise<Transaction[]> {
    let sql = `
      SELECT * FROM transactions 
      WHERE transaction_date >= ? AND transaction_date <= ?
    `;
    const params: any[] = [startDate, endDate];

    if (symbol) {
      sql += ` AND symbol = ?`;
      params.push(symbol);
    }

    sql += ` ORDER BY transaction_date ASC, id ASC`;

    const results = await db.query<SerializedTransaction>(sql, params);
    return results.map(deserializeTransaction);
  }

  /**
   * Find all transactions up to a date (for historical P/L calculation)
   */
  async findUpToDate(endDate: string, symbol?: string): Promise<Transaction[]> {
    let sql = `
      SELECT * FROM transactions 
      WHERE transaction_date <= ?
    `;
    const params: any[] = [endDate];

    if (symbol) {
      sql += ` AND symbol = ?`;
      params.push(symbol);
    }

    sql += ` ORDER BY transaction_date ASC, id ASC`;

    const results = await db.query<SerializedTransaction>(sql, params);
    return results.map(deserializeTransaction);
  }

  /**
   * Get all unique symbols
   */
  async getAllSymbols(): Promise<string[]> {
    const results = await db.query<{ symbol: string }>(
      `SELECT DISTINCT symbol FROM transactions ORDER BY symbol`
    );
    return results.map(r => r.symbol);
  }

  /**
   * Get existing content hashes (for deduplication)
   */
  async getExistingHashes(hashes: string[]): Promise<Set<string>> {
    if (hashes.length === 0) return new Set();

    // DuckDB might complain about too many bound variables, so chunking if large
    // But for now, simple approach
    // Note: DuckDB prepared statement with array params is tricky.
    // Better to use IN clause with string injection for pure hashes if safe
    // Or create a temporary table.
    // For simplicity, we loop or use standard binding.
    // However, sql.js implementation used: IN (?,?,?)

    // DuckDB WASM supports IN clause.
    const placeholders = hashes.map(() => '?').join(',');
    const results = await db.query<{ content_hash: string }>(
      `SELECT content_hash FROM transactions WHERE content_hash IN (${placeholders})`,
      hashes
    );

    return new Set(results.map(r => r.content_hash));
  }

  /**
   * Count total transactions
   */
  async count(): Promise<number> {
    const result = await db.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM transactions`
    );
    const count = result?.count;
    // DuckDB returns BigInt for count usually, need to handle Number conversion if needed
    return typeof count === 'bigint' ? Number(count) : count || 0;
  }

  /**
   * Delete a transaction by ID
   */
  async delete(id: string): Promise<void> {
    await db.run(`DELETE FROM transactions WHERE id = ?`, [id]);
    await db.checkpoint(true);
  }

  /**
   * Generate content hash for deduplication per design doc Section 6.2
   * Hash includes: symbol, date, quantity, price, broker
   */
  generateContentHash(tx: Transaction): string {
    const content = `${tx.symbol}|${tx.transaction_date}|${tx.quantity.toString()}|${tx.price.toString()}|${tx.broker}`;
    return this.simpleHash(content);
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }
  /**
   * Update transaction notes
   */
  async updateNotes(id: string, notes: string): Promise<void> {
    await db.run('UPDATE transactions SET notes = ? WHERE id = ?', [notes, id]);
    await db.checkpoint(true);
  }
}

export interface ImportBatch {
  id: string;
  broker: string;
  filename: string;
  imported_at: string;
  row_count: number;
}

export class ImportBatchRepository {
  async insert(batch: ImportBatch): Promise<void> {
    await db.run(
      `INSERT INTO import_batches (id, broker, filename, imported_at, row_count)
       VALUES (?, ?, ?, ?, ?)`,
      [
        batch.id,
        batch.broker,
        batch.filename,
        batch.imported_at,
        batch.row_count,
      ]
    );
    await db.checkpoint(true);
  }

  async findAll(): Promise<ImportBatch[]> {
    return db.query<ImportBatch>(
      `SELECT * FROM import_batches ORDER BY imported_at DESC`
    );
  }
}

// Singleton instances
export const transactionRepo = new TransactionRepository();
export const importBatchRepo = new ImportBatchRepository();
