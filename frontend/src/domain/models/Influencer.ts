// Enums for structured data
export type SignalType = 'BUY' | 'SELL' | 'HOLD';
export type TimeframeType = 'SHORT' | 'MID' | 'LONG';
export type SourceType = 'MANUAL' | 'AUTO_THREADS' | 'AUTO_SUBSTACK';
export type RecommendationStatus = 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'CLOSED';

export interface Influencer {
  id: string;
  name: string;
  platform?: string;
  url?: string;
  created_at: string;
  recommendation_count?: number;
}

export interface Recommendation {
  id: string;
  influencer_id: string;
  symbol: string;
  signal: SignalType;
  timeframe: TimeframeType;
  recommendation_date: string;
  entry_price: number | null;
  target_price?: number | null;
  stop_loss?: number | null;
  expiry_date?: string | null;
  source: SourceType;
  source_url?: string;
  note?: string;
  status: RecommendationStatus;
  created_at: string;

  // Calculated fields from backend
  current_price?: number;
  unrealized_return?: number;
  final_return?: number;
  hit_target?: boolean;
  hit_stop_loss?: boolean;
}

export interface InfluencerCreate {
  name: string;
  platform?: string;
  url?: string;
}

export interface RecommendationCreate {
  symbol: string;
  signal?: SignalType;
  timeframe?: TimeframeType;
  recommendation_date: string;
  entry_price?: number;
  target_price?: number;
  stop_loss?: number;
  expiry_date?: string;
  source?: SourceType;
  source_url?: string;
  note?: string;
}

export interface InfluencerUpdate {
  name?: string;
  platform?: string;
  url?: string;
}

export interface RecommendationUpdate {
  symbol?: string;
  signal?: SignalType;
  timeframe?: TimeframeType;
  recommendation_date?: string;
  entry_price?: number;
  target_price?: number;
  stop_loss?: number;
  expiry_date?: string;
  source?: SourceType;
  source_url?: string;
  note?: string;
  status?: RecommendationStatus;
}

export interface InfluencerWithStats extends Influencer {
  active_count: number;
  expired_count: number;
  win_rate?: number;
  avg_return?: number;
  hit_target_rate?: number;
}

export interface PendingReview {
  id: string;
  influencer_id: string;
  influencer_name: string;
  source: SourceType;
  source_url: string;
  original_content: string;
  ai_analysis: Record<string, unknown>;
  suggested_symbol?: string;
  suggested_signal?: SignalType;
  suggested_timeframe?: TimeframeType;
  confidence?: number;
  created_at: string;
}

// Helper functions
export const getTimeframeLabel = (tf: TimeframeType): string => {
  switch (tf) {
    case 'SHORT':
      return '短期 (<1週)';
    case 'MID':
      return '中期 (1-4週)';
    case 'LONG':
      return '長期 (>1月)';
    default:
      return tf;
  }
};

export const getSignalLabel = (signal: SignalType): string => {
  switch (signal) {
    case 'BUY':
      return '看多 📈';
    case 'SELL':
      return '看空 📉';
    case 'HOLD':
      return '觀望 ⏸️';
    default:
      return signal;
  }
};

export const getStatusLabel = (status: RecommendationStatus): string => {
  switch (status) {
    case 'PENDING':
      return '待審核';
    case 'ACTIVE':
      return '追蹤中';
    case 'EXPIRED':
      return '已到期';
    case 'CLOSED':
      return '已結束';
    default:
      return status;
  }
};
