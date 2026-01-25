import { Transaction } from '../../domain/models/Transaction';
import { apiClient } from '../api/client';

/**
 * Repository for Transaction CRUD operations
 * Refactored to use API Client instead of local DuckDB
 */
export class TransactionRepository {
  /**
   * Insert a single transaction
   */
  async insert(_transaction: Transaction): Promise<void> {
    console.warn('insert() not implemented in API mode');
  }

  /**
   * Insert multiple transactions in a single transaction
   */
  async insertBatch(_transactions: Transaction[]): Promise<number> {
    console.warn('insertBatch() not implemented in API mode');
    return 0;
  }

  /**
   * Find all transactions for a symbol, ordered by date
   */
  async findBySymbol(symbol: string): Promise<Transaction[]> {
    const all = await this.findAll();
    return all.filter(t => t.symbol === symbol);
  }

  /**
   * Find all transactions ordered by date
   */
  async findAll(): Promise<Transaction[]> {
    const all = await apiClient.getTransactions();
    return all.sort((a, b) => {
      const dateCompare = a.transaction_date.localeCompare(b.transaction_date);
      if (dateCompare !== 0) return dateCompare;
      return a.id.localeCompare(b.id);
    });
  }

  /**
   * Find transactions within a date range
   */
  async findByDateRange(
    startDate: string,
    endDate: string,
    symbol?: string
  ): Promise<Transaction[]> {
    const all = await this.findAll();
    return all.filter(t => {
      const dateMatch =
        t.transaction_date >= startDate && t.transaction_date <= endDate;
      const symbolMatch = symbol ? t.symbol === symbol : true;
      return dateMatch && symbolMatch;
    });
  }

  /**
   * Find all transactions up to a date (for historical P/L calculation)
   */
  async findUpToDate(endDate: string, symbol?: string): Promise<Transaction[]> {
    const all = await this.findAll();
    return all.filter(t => {
      const dateMatch = t.transaction_date <= endDate;
      const symbolMatch = symbol ? t.symbol === symbol : true;
      return dateMatch && symbolMatch;
    });
  }

  /**
   * Get all unique symbols
   */
  async getAllSymbols(): Promise<string[]> {
    const all = await apiClient.getTransactions();
    const symbols = new Set(all.map(t => t.symbol));
    return Array.from(symbols).sort();
  }

  /**
   * Get existing content hashes (for deduplication)
   */
  async getExistingHashes(_hashes: string[]): Promise<Set<string>> {
    // Not implemented efficiently via API yet.
    return new Set();
  }

  /**
   * Count total transactions
   */
  async count(): Promise<number> {
    const all = await apiClient.getTransactions();
    return all.length;
  }

  /**
   * Delete a transaction by ID
   */
  async delete(_id: string): Promise<void> {
    console.warn('delete() not implemented in API mode');
  }

  /**
   * Update transaction notes
   */
  async updateNotes(_id: string, _notes: string): Promise<void> {
    console.warn('updateNotes() not implemented in API mode');
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
  async insert(_batch: ImportBatch): Promise<void> {
    console.warn('ImportBatchRepository.insert() not implemented in API mode');
  }

  async findAll(): Promise<ImportBatch[]> {
    console.warn('ImportBatchRepository.findAll() not implemented in API mode');
    return [];
  }
}

// Singleton instances
export const transactionRepo = new TransactionRepository();
export const importBatchRepo = new ImportBatchRepository();
