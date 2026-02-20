import { Transaction } from '../../domain/models/Transaction';
import { Portfolio } from '../../domain/models/Portfolio';
import {
  Influencer,
  InfluencerCreate,
  InfluencerUpdate,
  Recommendation,
  RecommendationCreate,
  RecommendationUpdate,
} from '../../domain/models/Influencer';
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
      body: formData,
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

  updateTransactionNotes: async (
    id: string,
    notes: string,
    tags?: string[],
    rating?: number
  ): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes, tags, rating }),
    });
    await handleResponse(response);
  },

  deleteTransaction: async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/transactions/${id}`, {
      method: 'DELETE',
    });
    await handleResponse(response);
  },

  getBehavioralAnalytics: async (): Promise<BehavioralAnalytics> => {
    const response = await fetch(
      `${API_BASE_URL}/portfolio/analytics/behavior`
    );
    return handleResponse(response);
  },

  // Influencer API
  getInfluencers: async (): Promise<Influencer[]> => {
    const response = await fetch(`${API_BASE_URL}/influencers`);
    return handleResponse(response);
  },

  createInfluencer: async (data: InfluencerCreate): Promise<Influencer> => {
    const response = await fetch(`${API_BASE_URL}/influencers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  deleteInfluencer: async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/influencers/${id}`, {
      method: 'DELETE',
    });
    await handleResponse(response);
  },

  getRecommendations: async (): Promise<Recommendation[]> => {
    const response = await fetch(`${API_BASE_URL}/recommendations`);
    return handleResponse(response);
  },

  createRecommendation: async (
    influencerId: string,
    data: RecommendationCreate
  ): Promise<Recommendation> => {
    // Legacy support or use batch under hood
    const result = await apiClient.createRecommendationsBatch(influencerId, [
      data,
    ]);
    if (!result || result.length === 0) {
      throw new Error('Failed to create recommendation');
    }
    return result[0] as Recommendation;
  },

  createRecommendationsBatch: async (
    influencerId: string,
    data: RecommendationCreate[]
  ): Promise<Recommendation[]> => {
    const response = await fetch(
      `${API_BASE_URL}/influencers/${influencerId}/recommendations/batch`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }
    );
    return handleResponse(response);
  },

  deleteRecommendation: async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/recommendations/${id}`, {
      method: 'DELETE',
    });
    await handleResponse(response);
  },

  updateInfluencer: async (
    id: string,
    data: InfluencerUpdate
  ): Promise<Influencer> => {
    const response = await fetch(`${API_BASE_URL}/influencers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  updateRecommendation: async (
    id: string,
    data: RecommendationUpdate
  ): Promise<Recommendation> => {
    const response = await fetch(`${API_BASE_URL}/recommendations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  // Auto-Tracking API
  triggerAutoTrack: async (
    influencerId: string,
    platform: string = 'threads',
    limit: number = 5
  ): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/auto-track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ influencer_id: influencerId, platform, limit }),
    });
    return handleResponse(response);
  },

  getPendingReviews: async (influencerId?: string): Promise<any[]> => {
    const params = influencerId ? `?influencer_id=${influencerId}` : '';
    const response = await fetch(`${API_BASE_URL}/pending-reviews${params}`);
    return handleResponse(response);
  },

  getScrapedPosts: async (influencerId?: string): Promise<any[]> => {
    const params = influencerId ? `?influencer_id=${influencerId}` : '';
    const response = await fetch(`${API_BASE_URL}/scraped-posts${params}`);
    return handleResponse(response);
  },

  deleteScrapedPost: async (postId: string): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/scraped-posts/${postId}`, {
      method: 'DELETE',
    });
    return handleResponse(response);
  },

  bulkDeleteScrapedPosts: async (ids: string[]): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/scraped-posts/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    return handleResponse(response);
  },

  approvePendingReview: async (reviewId: string, data: any): Promise<any> => {
    const response = await fetch(
      `${API_BASE_URL}/pending-reviews/${reviewId}/approve`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }
    );
    return handleResponse(response);
  },

  rejectPendingReview: async (reviewId: string): Promise<any> => {
    const response = await fetch(
      `${API_BASE_URL}/pending-reviews/${reviewId}/reject`,
      {
        method: 'POST',
      }
    );
    return handleResponse(response);
  },

  // Batch Operations
  triggerAutoTrackAll: async (
    limit: number = 5,
    autoApproveThreshold?: number
  ): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/auto-track-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        limit,
        auto_approve_threshold: autoApproveThreshold ?? null,
      }),
    });
    return handleResponse(response);
  },

  approveAllPending: async (): Promise<any> => {
    const response = await fetch(
      `${API_BASE_URL}/pending-reviews/approve-all`,
      { method: 'POST' }
    );
    return handleResponse(response);
  },

  autoApprovePending: async (threshold: number = 0.7): Promise<any> => {
    const response = await fetch(
      `${API_BASE_URL}/pending-reviews/auto-approve`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threshold }),
      }
    );
    return handleResponse(response);
  },
};

export interface BehavioralAnalytics {
  metrics: {
    avgHoldingDaysWinners: number;
    avgHoldingDaysLosers: number;
    avgHoldingDaysWinnersOpen: number;
    avgHoldingDaysLosersOpen: number;
    totalWinners: number;
    totalLosers: number;
    openWinners: number;
    openLosers: number;
  };
  trades: {
    symbol: string;
    quantity: number;
    entryDate: string;
    exitDate: string;
    realizedPl: number;
    holdingDays: number;
    status: 'OPEN' | 'CLOSED';
    mfe: number;
    mae: number;
    efficiency: number;
    entryPrice: number;
    exitPrice: number;
  }[];
}
