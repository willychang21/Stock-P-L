import { apiClient } from '../../infrastructure/api/client';
import {
  ScreenerFilters,
  ScreenerResponse,
} from '../../domain/models/ScreenerStock';

export const ScreenerService = {
  fetchStocks: async (filters: ScreenerFilters): Promise<ScreenerResponse> => {
    return apiClient.getScreenerStocks(filters);
  },

  syncTickers: async (tickers: string[]): Promise<void> => {
    await apiClient.triggerScreenerSync(tickers);
  },

  syncAll: async (): Promise<any> => {
    return apiClient.triggerScreenerSyncAll();
  },

  getSyncStatus: async (): Promise<any> => {
    return apiClient.getScreenerSyncStatus();
  },

  listViews: async (): Promise<any[]> => {
    return apiClient.listScreenerViews();
  },

  createView: async (payload: any): Promise<any> => {
    return apiClient.createScreenerView(payload);
  },

  deleteView: async (viewId: string): Promise<void> => {
    await apiClient.deleteScreenerView(viewId);
  },

  listScreens: async (): Promise<any[]> => {
    return apiClient.listScreenerScreens();
  },

  createScreen: async (payload: any): Promise<any> => {
    return apiClient.createScreenerScreen(payload);
  },

  updateScreen: async (screenId: string, payload: any): Promise<any> => {
    return apiClient.updateScreenerScreen(screenId, payload);
  },

  deleteScreen: async (screenId: string): Promise<void> => {
    await apiClient.deleteScreenerScreen(screenId);
  },

  checkAlerts: async (): Promise<any> => {
    return apiClient.checkScreenerAlerts();
  },

  listAlerts: async (limit: number = 50): Promise<any[]> => {
    return apiClient.listScreenerAlerts(limit);
  },

  markAlertRead: async (eventId: string): Promise<void> => {
    await apiClient.markScreenerAlertRead(eventId);
  },

  getSymbolInsights: async (symbol: string): Promise<any> => {
    return apiClient.getScreenerSymbolInsights(symbol);
  },

  getMarketPulse: async (): Promise<any> => {
    return apiClient.getScreenerMarketPulse();
  },
};
