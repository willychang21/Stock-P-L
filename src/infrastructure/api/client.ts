import { Transaction } from '../../domain/models/Transaction';
import { PortfolioSummary } from '../../domain/models/PortfolioSummary';
import Decimal from 'decimal.js';

const API_BASE_URL = 'http://localhost:3001/api';

export const apiClient = {
  getPortfolioSummary: async (): Promise<PortfolioSummary> => {
    const response = await fetch(`${API_BASE_URL}/portfolio/summary`);
    if (!response.ok) {
      throw new Error(`Failed to fetch portfolio summary: ${response.statusText}`);
    }
    return response.json();
  },

  getTransactions: async (): Promise<Transaction[]> => {
    const response = await fetch(`${API_BASE_URL}/transactions`);
    if (!response.ok) {
      throw new Error(`Failed to fetch transactions: ${response.statusText}`);
    }
    const data = await response.json();
    return data.map((item: any) => ({
      ...item,
      quantity: new Decimal(item.quantity),
      price: new Decimal(item.price),
      fees: new Decimal(item.fees),
      total_amount: new Decimal(item.total_amount),
    }));
  },
  
  // Placeholder for future methods
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
  }
};
