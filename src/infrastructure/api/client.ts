import { Transaction } from '../../domain/models/Transaction';
import { Portfolio } from '../../domain/models/Portfolio';
import Decimal from 'decimal.js';

const API_BASE_URL = 'http://localhost:3001/api';

async function handleResponse(response: Response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || response.statusText;
    throw new Error(message);
  }
  return response.json();
}

export const apiClient = {
  getPortfolio: async (calculatorId: string = 'fifo'): Promise<Portfolio> => {
    const params = new URLSearchParams({ calculator_id: calculatorId });
    const response = await fetch(`${API_BASE_URL}/portfolio/summary?${params}`);
    const data = await handleResponse(response);
    return {
      holdings: (data.holdings || []).map((h: any) => ({
        symbol: h.symbol,
        quantity: new Decimal(h.quantity),
        averageCost: new Decimal(h.average_cost),
        currentPrice: new Decimal(h.current_price),
        marketValue: new Decimal(h.market_value),
        unrealizedPL: new Decimal(h.unrealized_pl),
        realizedPL: new Decimal(h.realized_pl),
        assetType: h.asset_type || 'EQUITY',
        costBasis: new Decimal(h.average_cost).mul(h.quantity),
      })),
      totalMarketValue: new Decimal(data.total_market_value),
      totalUnrealizedPL: new Decimal(data.total_unrealized_pl),
      totalRealizedPL: new Decimal(data.total_realized_pl),
      cashBalance: new Decimal(data.cash_balance),
    };
  },

  getTransactions: async (): Promise<Transaction[]> => {
    const response = await fetch(`${API_BASE_URL}/transactions`);
    if (!response.ok) {
      throw new Error(`Failed to fetch transactions: ${response.statusText}`);
    }
    const data = await response.json();
    return data.map((item: any) => ({
      id: item.id,
      date: new Date(item.date || item.transaction_date),
      symbol: item.symbol,
      type: item.type || item.transaction_type,
      quantity: new Decimal(item.quantity || 0),
      price: new Decimal(item.price || 0),
      fees: new Decimal(item.fees || 0),
      currency: item.currency || 'USD',
      broker: item.broker,
      rawData: item.rawData || item.raw_data,
      notes: item.notes,
    }));
  },

  uploadImport: async (formData: FormData): Promise<any> => {
      const response = await fetch(`${API_BASE_URL}/import`, {
          method: 'POST',
          body: formData
      });
      if (!response.ok) {
          throw new Error(`Failed to upload file: ${response.statusText}`);
      }
      return response.json();
  },

  getQuotes: async (symbols: string[]): Promise<any> => {
      const params = new URLSearchParams({ symbols: symbols.join(',') });
      const response = await fetch(`${API_BASE_URL}/quotes?${params}`);
       if (!response.ok) {
          throw new Error(`Failed to fetch quotes: ${response.statusText}`);
      }
      return response.json();
  },

  updateTransactionNotes: async (id: string, notes: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    });
    await handleResponse(response);
  },

  deleteTransaction: async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/transactions/${id}`, {
      method: 'DELETE',
    });
    await handleResponse(response);
  }
};
