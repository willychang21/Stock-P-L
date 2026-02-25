export interface MarketSentiment {
  vix: {
    value: number;
    trend: 'RISING' | 'FALLING' | 'FLAT';
    previousWeek: number;
  };
  safeHavens: {
    goldTrend: 'RISING' | 'FALLING';
    treasuryYieldTrend: 'RISING' | 'FALLING';
  };
  marketRegime: 'NORMAL' | 'HIGH_FEAR' | 'RISK_OFF' | 'COMPLACENCY';
  timestamp: string;
}
