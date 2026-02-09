import { RawTransaction, Broker } from '@domain/models/Transaction';

/**
 * Broker adapter interface for CSV import
 * Each broker has different CSV column names and formats
 */
export interface BrokerAdapter {
  broker: Broker;

  /**
   * Check if this adapter can handle the given CSV headers
   * Used for auto-detection
   */
  canHandle(headers: string[]): boolean;

  /**
   * Parse a single CSV row to RawTransaction
   */
  /**
   * Parse a single CSV row to RawTransaction
   */
  parseRow(row: Record<string, string>): RawTransaction | null;
}

/**
 * Registry to manage and auto-detect broker adapters
 */
export class AdapterRegistry {
  private adapters: Map<Broker, BrokerAdapter> = new Map();

  register(adapter: BrokerAdapter): void {
    this.adapters.set(adapter.broker, adapter);
  }

  get(broker: Broker): BrokerAdapter | undefined {
    return this.adapters.get(broker);
  }

  /**
   * Auto-detect which adapter to use based on CSV headers
   */
  autoDetect(headers: string[]): BrokerAdapter | null {
    for (const adapter of this.adapters.values()) {
      if (adapter.canHandle(headers)) {
        return adapter;
      }
    }
    return null;
  }

  getAllBrokers(): Broker[] {
    return Array.from(this.adapters.keys());
  }
}

// Singleton registry
export const adapterRegistry = new AdapterRegistry();
