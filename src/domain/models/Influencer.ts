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
  recommendation_date: string;
  initial_price: number | null;
  note?: string;
  created_at: string;

  // Calculated fields from backend
  current_price?: number;
  price_change_percent?: number;
}

export interface InfluencerCreate {
  name: string;
  platform?: string;
  url?: string;
}

export interface RecommendationCreate {
  symbol: string;
  recommendation_date: string;
  initial_price?: number;
  note?: string;
}

export interface InfluencerUpdate {
  name?: string;
  platform?: string;
  url?: string;
}

export interface RecommendationUpdate {
  symbol?: string;
  recommendation_date?: string;
  initial_price?: number;
  note?: string;
}
