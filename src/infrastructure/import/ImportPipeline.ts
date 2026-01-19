import { csvParser } from './CSVParser';
import { adapterRegistry } from './adapters/BrokerAdapter';
import {
  transactionRepo,
  importBatchRepo,
} from '../storage/TransactionRepository';
import {
  createTransaction,
  Broker,
  RawTransaction,
} from '@domain/models/Transaction';
import './adapters/RobinhoodAdapter'; // Register adapter
import './adapters/SchwabAdapter'; // Register adapter

/**
 * Result of CSV import operation
 */
export interface ImportResult {
  success: boolean;
  import_batch_id: string;
  total_rows: number;
  imported_count: number;
  duplicate_count: number;
  error_count: number;
  errors: Array<{ row: number; message: string }>;
}

/**
 * Import pipeline orchestrator
 * Coordinates: Parse → Adapt → Validate → Deduplicate → Insert
 */
export class ImportPipeline {
  /**
   * Process a CSV file import
   * @param file CSV file to import
   * @param broker Broker type (or null for auto-detect)
   * @returns Import result with statistics
   */
  async processFile(
    file: File,
    broker: Broker | null = null
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      import_batch_id: crypto.randomUUID(),
      total_rows: 0,
      imported_count: 0,
      duplicate_count: 0,
      error_count: 0,
      errors: [],
    };

    try {
      // Step 1: Parse CSV
      const rows = await csvParser.parse(file);
      result.total_rows = rows.length;

      // Step 2: Detect or get broker adapter
      const adapter = broker
        ? adapterRegistry.get(broker)
        : await this.autoDetectAdapter(file);

      if (!adapter) {
        throw new Error(
          'Could not detect broker format. Please select broker manually.'
        );
      }

      // Step 3: Parse rows to RawTransactions
      const rawTransactions: RawTransaction[] = [];
      for (let i = 0; i < rows.length; i++) {
        try {
          const rawTx = adapter.parseRow(rows[i]!);
          if (rawTx) {
            rawTransactions.push(rawTx);
          }
        } catch (error) {
          result.error_count++;
          result.errors.push({
            row: i + 1,
            message: error instanceof Error ? error.message : 'Parse error',
          });
        }
      }

      // Step 4: Normalize to Transaction models
      const transactions = rawTransactions.map(raw =>
        createTransaction(raw, result.import_batch_id)
      );

      // Step 5: Insert with deduplication (repository handles this)
      result.imported_count = await transactionRepo.insertBatch(transactions);
      result.duplicate_count = transactions.length - result.imported_count;

      // Step 6: Record import batch metadata
      await importBatchRepo.insert({
        id: result.import_batch_id,
        broker: adapter.broker,
        filename: file.name,
        imported_at: new Date().toISOString(),
        row_count: result.imported_count,
      });

      // Step 7: Checkpoint is handled by transactionRepo.insertBatch automatically
      // await db.checkpoint();

      result.success = true;
    } catch (error) {
      result.success = false;
      result.errors.push({
        row: 0,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return result;
  }

  /**
   * Auto-detect broker from CSV headers
   */
  private async autoDetectAdapter(file: File) {
    const headers = await csvParser.getHeaders(file);
    return adapterRegistry.autoDetect(headers);
  }
}

// Singleton instance
export const importPipeline = new ImportPipeline();
