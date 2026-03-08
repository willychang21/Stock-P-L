import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Divider,
  Grid,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  Calculate as CalculateIcon,
  DeleteOutline as DeleteOutlineIcon,
  Insights as InsightsIcon,
  WarningAmberOutlined as WarningAmberOutlinedIcon,
} from '@mui/icons-material';
import { WatchlistItem } from '../../../domain/models/Watchlist';
import {
  formatCurrency,
  formatNumber,
  formatRange,
  formatSignedPercent,
} from '../../utils/formatters';
import {
  displayStateColor,
  getDisplayState,
  getConvictionScore,
  getUpsidePct,
  getHeadlinePe,
  planColor,
  qualityTone,
  valueTrapColor,
  cycleRiskColor,
  formatPeMultiple,
  formatCoverageBucket,
} from './utils';
import {
  getAlertPaperStyles,
  getCardStyles,
  getFactorChipStyles,
  getMetricsPaperStyles,
} from './WatchlistCard.styles';

export const InsightBullet: React.FC<{
  text: string;
  tone: 'success' | 'warning' | 'error';
}> = ({ text, tone }) => {
  const theme = useTheme();
  const color =
    tone === 'success'
      ? theme.palette.success.light
      : tone === 'warning'
        ? theme.palette.warning.light
        : theme.palette.error.light;

  return (
    <Typography
      variant="body2"
      color="text.secondary"
      sx={{
        display: 'flex',
        gap: 1,
        alignItems: 'flex-start',
        lineHeight: 1.5,
      }}
    >
      <span style={{ color, fontWeight: 700 }}>•</span>
      <span>{text}</span>
    </Typography>
  );
};

export const MetricTile: React.FC<{
  label: string;
  value: string;
  tone: 'neutral' | 'success' | 'warning' | 'error' | 'info';
}> = ({ label, value, tone }) => {
  const theme = useTheme();
  const color =
    tone === 'success'
      ? theme.palette.success.main
      : tone === 'warning'
        ? theme.palette.warning.main
        : tone === 'error'
          ? theme.palette.error.main
          : tone === 'info'
            ? theme.palette.info.main
            : theme.palette.text.primary;

  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontWeight: 800,
          color,
          mt: 0.35,
          wordBreak: 'break-word',
        }}
      >
        {value}
      </Typography>
    </Box>
  );
};

export const FactorChip: React.FC<{
  label: string;
  value: string | number;
  suffix?: string;
  tone: 'neutral' | 'success' | 'warning' | 'error' | 'info';
}> = ({ label, value, suffix, tone }) => {
  const theme = useTheme();
  const styles = getFactorChipStyles();
  const color =
    tone === 'success'
      ? theme.palette.success.light
      : tone === 'warning'
        ? theme.palette.warning.light
        : tone === 'error'
          ? theme.palette.error.light
          : tone === 'info'
            ? theme.palette.info.light
            : theme.palette.text.primary;

  return (
    <Box sx={styles}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          mb: 0.25,
          fontSize: '0.65rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 700, color, lineHeight: 1.2 }}>
        {value}
        {suffix && (
          <span style={{ opacity: 0.6, fontSize: '0.8em', marginLeft: 2 }}>
            {suffix}
          </span>
        )}
      </Typography>
    </Box>
  );
};

export interface WatchlistCardProps {
  item: WatchlistItem;
  showExecutionOverlay: boolean;
  onRemove: (symbol: string) => void;
  onOpenDCF: (item: WatchlistItem) => void;
  onOpenInsights: (symbol: string) => void;
}

export const WatchlistCard: React.FC<WatchlistCardProps> = React.memo(({
  item,
  showExecutionOverlay,
  onRemove,
  onOpenDCF,
  onOpenInsights,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();

  const industryLabel = [item.sector, item.industry].filter(Boolean).join(' / ');
  const displayState = getDisplayState(item);
  const convictionScore = getConvictionScore(item);
  const convictionColor =
    convictionScore >= 80
      ? theme.palette.success.main
      : convictionScore >= 60
        ? theme.palette.info.main
        : theme.palette.warning.main;

  const hasAlerts =
    item.value_trap.level === 'HIGH' ||
    item.cycle_profile.peak_earnings_risk === 'HIGH' ||
    item.technical.warnings.length > 0;

  return (
    <Card sx={getCardStyles(theme, displayState, hasAlerts)}>
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack spacing={2.5}>
          {/* HEADER */}
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', md: 'center' }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ rowGap: 1, mb: 0.5 }}>
                <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: '-0.03em' }}>
                  {item.symbol}
                </Typography>
                <Chip
                  size="small"
                  color={displayStateColor(displayState)}
                  label={t(`watchlist.card.states.${displayState}`)}
                  sx={{ fontWeight: 800 }}
                />
                {item.cycle_profile.is_cyclical && (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={t('watchlist.cycle.badges.cyclical')}
                    sx={{ color: 'text.secondary', borderColor: 'divider' }}
                  />
                )}
              </Stack>
              <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.25 }}>
                {item.name || t('watchlist.card.nameUnavailable')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {[industryLabel, t('watchlist.card.mktCap', { value: formatCurrency(item.market_cap) })]
                  .filter(Boolean)
                  .join(' • ')}
              </Typography>
            </Box>

            <Stack
              direction="row"
              spacing={2.5}
              alignItems="center"
              sx={{ alignSelf: { xs: 'stretch', md: 'auto' }, justifyContent: 'space-between' }}
            >
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: '0.08em' }}>
                  {t('watchlist.card.metrics.price')}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.05 }}>
                  {formatCurrency(item.price)}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: getUpsidePct(item) >= 0 ? 'success.light' : 'error.light', fontWeight: 700 }}
                >
                  {getUpsidePct(item) >= 0 ? '+' : ''}
                  {formatSignedPercent(item.valuation.upside_pct, 1)} {t('watchlist.card.metrics.margin')}
                </Typography>
              </Box>

              <Divider orientation="vertical" flexItem sx={{ my: 1, display: { xs: 'none', sm: 'block' } }} />

              <Box sx={{ textAlign: 'center', minWidth: 64 }}>
                <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: '0.08em', display: 'block' }}>
                  CONVICTION
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 900, color: convictionColor, lineHeight: 1 }}>
                  {convictionScore}
                </Typography>
              </Box>

              <Tooltip title={t('watchlist.card.remove')}>
                <IconButton
                  color="error"
                  size="small"
                  onClick={() => onRemove(item.symbol)}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>

          {/* MIDDLE: METRICS & EXECUTION */}
          <Paper sx={getMetricsPaperStyles(theme)}>
            <Grid container spacing={2}>
              <Grid item xs={4} md={2}>
                <MetricTile
                  label={t('watchlist.card.metrics.headlinePe')}
                  value={formatPeMultiple(getHeadlinePe(item))}
                  tone="neutral"
                />
              </Grid>
              <Grid item xs={4} md={2}>
                <MetricTile
                  label={t('watchlist.card.metrics.fairValueRange')}
                  value={formatRange(item.valuation.fair_value_low, item.valuation.fair_value_high)}
                  tone="neutral"
                />
              </Grid>
              <Grid item xs={4} md={2}>
                <MetricTile
                  label={t('watchlist.card.tradePlan.entryZone')}
                  value={formatRange(item.trade_plan.entry_low, item.trade_plan.entry_high)}
                  tone="info"
                />
              </Grid>
              <Grid item xs={4} md={2}>
                <MetricTile
                  label={t('watchlist.card.tradePlan.target')}
                  value={formatCurrency(item.trade_plan.take_profit_1)}
                  tone="success"
                />
              </Grid>
              <Grid item xs={4} md={2}>
                <MetricTile
                  label={t('watchlist.card.tradePlan.stopLoss')}
                  value={formatCurrency(item.trade_plan.stop_loss)}
                  tone="error"
                />
              </Grid>
              <Grid item xs={4} md={2}>
                <MetricTile
                  label={t('watchlist.card.tradePlan.rr')}
                  value={formatNumber(item.trade_plan.rr_to_tp1, 1)}
                  tone={item.trade_plan.rr_to_tp1 && item.trade_plan.rr_to_tp1 >= 2 ? 'success' : 'warning'}
                />
              </Grid>
            </Grid>
            <Collapse in={showExecutionOverlay}>
              <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px dashed ${alpha(theme.palette.common.white, 0.1)}` }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <CalculateIcon fontSize="small" sx={{ color: theme.palette.warning.light }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                    {t('watchlist.card.execution.title')}
                  </Typography>
                  <Chip
                    size="small"
                    color={planColor(item.trade_plan.plan_type)}
                    label={t(`watchlist.card.plans.${item.trade_plan.plan_type}`)}
                  />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {t(item.trade_plan.summary.key, item.trade_plan.summary.params)}
                </Typography>
              </Box>
            </Collapse>
          </Paper>

          {/* BOTTOM: FACTORS */}
          <Stack spacing={1.5}>
            <Grid container spacing={1.25}>
              <Grid item xs={6} sm={3}>
                <FactorChip
                  label={t('watchlist.card.metrics.quality')}
                  value={item.quality.score}
                  suffix="/100"
                  tone={qualityTone(item.quality.outlook)}
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <FactorChip
                  label={t('watchlist.card.metrics.timing')}
                  value={item.timing.score}
                  suffix="/100"
                  tone={item.timing.status === 'READY' ? 'success' : 'neutral'}
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <FactorChip
                  label={t('watchlist.card.sections.structuralTrap')}
                  value={t(`watchlist.valueTrap.levels.${item.value_trap.level}`)}
                  tone={valueTrapColor(item.value_trap.level)}
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <FactorChip
                  label={t('watchlist.card.sections.cycleCheck')}
                  value={t(`watchlist.cycle.risk.${item.cycle_profile.peak_earnings_risk}`)}
                  tone={cycleRiskColor(item.cycle_profile.peak_earnings_risk)}
                />
              </Grid>
            </Grid>

            {/* RISK ALERTS */}
            {hasAlerts && (
              <Paper sx={getAlertPaperStyles(theme)}>
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                    <WarningAmberOutlinedIcon fontSize="small" color="error" />
                    <Typography variant="subtitle2" color="error.main" sx={{ fontWeight: 700 }}>
                      {t('watchlist.card.sections.riskAlerts', 'Risk Alerts')}
                    </Typography>
                  </Stack>
                  {item.value_trap.level === 'HIGH' &&
                    item.value_trap.reasons.map((r, i) => (
                      <InsightBullet key={`vt-${i}`} text={t(r.key, r.params)} tone="error" />
                    ))}
                  {item.cycle_profile.peak_earnings_risk === 'HIGH' &&
                    item.cycle_profile.reasons.map((r, i) => (
                      <InsightBullet key={`cr-${i}`} text={t(r.key, r.params)} tone="warning" />
                    ))}
                  {item.technical.warnings.map((w, i) => (
                    <InsightBullet key={`tw-${i}`} text={t(w.key, w.params)} tone="error" />
                  ))}
                </Stack>
              </Paper>
            )}
          </Stack>

          {/* FOOTER */}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.25}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            sx={{
              pt: 1,
              borderTop: `1px solid ${alpha(theme.palette.common.white, 0.08)}`,
            }}
          >
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ rowGap: 0.75 }}>
              <Tooltip
                arrow
                title={
                  item.signal.coverage_breakdown ? (
                    <Stack spacing={0.5} sx={{ py: 0.25 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700 }}>
                        {t('watchlist.coverage.tooltip.framework', {
                          value: t(`watchlist.coverage.frameworks.${item.signal.coverage_breakdown.framework}`),
                        })}
                      </Typography>
                      <Typography variant="caption">
                        {t('watchlist.coverage.tooltip.fundamentals', {
                          value: formatCoverageBucket(item.signal.coverage_breakdown.fundamentals),
                        })}
                      </Typography>
                      <Typography variant="caption">
                        {t('watchlist.coverage.tooltip.technical', {
                          value: formatCoverageBucket(item.signal.coverage_breakdown.technical),
                        })}
                      </Typography>
                      <Typography variant="caption">
                        {t('watchlist.coverage.tooltip.valuation', {
                          value: formatCoverageBucket(item.signal.coverage_breakdown.valuation),
                        })}
                      </Typography>
                      <Typography variant="caption" color="inherit" sx={{ opacity: 0.86 }}>
                        {item.signal.coverage_breakdown.missing_groups.length > 0
                          ? t('watchlist.coverage.tooltip.missing', {
                              value: item.signal.coverage_breakdown.missing_groups
                                .map(group => t(`watchlist.coverage.groups.${group}`))
                                .join(', '),
                            })
                          : t('watchlist.coverage.tooltip.complete')}
                      </Typography>
                    </Stack>
                  ) : (
                    ''
                  )
                }
              >
                <Chip
                  size="small"
                  variant="outlined"
                  label={t('watchlist.card.coverage', {
                    percent: (item.signal.data_coverage * 100).toFixed(0),
                  })}
                  sx={{ borderColor: 'divider', color: 'text.secondary' }}
                />
              </Tooltip>
              <Chip
                size="small"
                variant="outlined"
                label={t('watchlist.card.confidence', {
                  percent: item.signal.confidence,
                })}
                sx={{ borderColor: 'divider', color: 'text.secondary' }}
              />
              <Chip
                size="small"
                variant="outlined"
                label={
                  item.timing.freshness_days !== undefined && item.timing.freshness_days !== null
                    ? t('watchlist.card.freshness', { value: item.timing.freshness_days })
                    : t('watchlist.card.freshnessUnknown')
                }
                sx={{ borderColor: 'divider', color: 'text.secondary' }}
              />
            </Stack>

            <Stack direction="row" spacing={1}>
              {!showExecutionOverlay && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<CalculateIcon />}
                  onClick={() => onOpenDCF(item)}
                  sx={{ color: 'text.secondary', borderColor: 'divider' }}
                >
                  {t('watchlist.card.valuation.model')}
                </Button>
              )}
              <Button
                size="small"
                variant="contained"
                endIcon={<InsightsIcon />}
                onClick={() => onOpenInsights(item.symbol)}
                sx={{ fontWeight: 700 }}
              >
                {t('watchlist.card.deepDive')}
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
});
