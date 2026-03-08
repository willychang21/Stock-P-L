import { WatchlistItem, WatchPlanType } from '../../../domain/models/Watchlist';
import { formatNumber } from '../../utils/formatters';

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const planColor = (
  planType: WatchPlanType
): 'success' | 'info' | 'warning' | 'error' => {
  if (planType === 'LONG') return 'success';
  if (planType === 'WAIT') return 'info';
  if (planType === 'AVOID') return 'warning';
  return 'info';
};

export const valueTrapColor = (
  level: WatchlistItem['value_trap']['level']
): 'success' | 'warning' | 'error' => {
  if (level === 'LOW') return 'success';
  if (level === 'MEDIUM') return 'warning';
  return 'error';
};

export const cycleRiskColor = (
  level: WatchlistItem['cycle_profile']['peak_earnings_risk']
): 'success' | 'warning' | 'error' => {
  if (level === 'LOW') return 'success';
  if (level === 'MEDIUM') return 'warning';
  return 'error';
};

export type WatchlistDisplayState =
  | 'READY'
  | 'WAIT_PULLBACK'
  | 'WAIT_CONFIRMATION'
  | 'RESEARCH_ONLY'
  | 'AVOID';

export const getDisplayState = (item: WatchlistItem): WatchlistDisplayState => {
  if (item.timing.status === 'AVOID') {
    return 'AVOID';
  }

  if (item.signal.data_coverage < 0.6 || item.timing.status === 'STALE') {
    return 'RESEARCH_ONLY';
  }

  return item.timing.status;
};

export const displayStateColor = (
  state: WatchlistDisplayState
): 'success' | 'warning' | 'info' | 'default' | 'error' => {
  if (state === 'READY') return 'success';
  if (state === 'WAIT_PULLBACK') return 'warning';
  if (state === 'RESEARCH_ONLY') return 'default';
  if (state === 'AVOID') return 'error';
  return 'info';
};

export const qualityTone = (
  outlook: WatchlistItem['quality']['outlook']
): 'success' | 'info' | 'warning' | 'error' => {
  if (outlook === 'ELITE') return 'success';
  if (outlook === 'STRONG') return 'info';
  if (outlook === 'AVERAGE') return 'warning';
  return 'error';
};

export const getUpsidePct = (item: WatchlistItem) => item.valuation.upside_pct ?? -1;
export const getHeadlinePe = (item: WatchlistItem) =>
  item.forward_pe && item.forward_pe > 0 ? item.forward_pe : item.trailing_pe;
export const formatPeMultiple = (value?: number) =>
  value === undefined || value === null ? '-' : `${formatNumber(value, 1)}x`;
export const formatCoverageBucket = (bucket?: { have: number; total: number }) =>
  bucket ? `${bucket.have}/${bucket.total}` : '-';

export const getConvictionScore = (item: WatchlistItem) => {
  const upsideScore = clamp(((getUpsidePct(item) + 0.2) / 0.6) * 100, 0, 100);
  const structuralSafetyScore = 100 - item.value_trap.score;
  const cycleSafetyScore = 100 - item.cycle_profile.score;

  return Math.round(
    clamp(
      item.quality.score * 0.28 +
        item.timing.score * 0.25 +
        item.signal.confidence * 0.15 +
        upsideScore * 0.14 +
        structuralSafetyScore * 0.10 +
        cycleSafetyScore * 0.08,
      0,
      100
    )
  );
};
