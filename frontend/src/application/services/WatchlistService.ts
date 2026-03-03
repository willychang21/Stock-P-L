import { apiClient } from '../../infrastructure/api/client';
import {
  WatchlistItem,
  WatchlistResponse,
  WatchlistSearchItem,
} from '../../domain/models/Watchlist';

export const WatchlistService = {
  fetchWatchlist: async (): Promise<WatchlistResponse> => {
    return apiClient.listWatchlist();
  },

  searchSymbols: async (
    q: string,
    limit: number = 12
  ): Promise<WatchlistSearchItem[]> => {
    return apiClient.searchWatchlistSymbols(q, limit);
  },

  addSymbol: async (symbol: string, note?: string): Promise<WatchlistItem> => {
    return apiClient.addWatchlistItem({ symbol, note });
  },

  updateNote: async (symbol: string, note?: string): Promise<WatchlistItem> => {
    return apiClient.updateWatchlistItem(symbol, { note });
  },

  removeSymbol: async (symbol: string): Promise<void> => {
    await apiClient.removeWatchlistItem(symbol);
  },

  getSymbolInsights: async (symbol: string): Promise<any> => {
    return apiClient.getScreenerSymbolInsights(symbol);
  },

  fetchHistoricalFinancials: async (symbol: string): Promise<any> => {
    return apiClient.getHistoricalFinancials(symbol);
  },

  simulateDCF: async (payload: any): Promise<any> => {
    return apiClient.simulateDCF(payload);
  },
};
