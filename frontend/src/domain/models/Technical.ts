export interface Technical {
  symbol: string;
  rsi14?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekPosition?: number;
  currentPrice?: number;
  volume?: number;
  avgVolume10D?: number;
  avgVolume3M?: number;
  warnings?: string[];
}
