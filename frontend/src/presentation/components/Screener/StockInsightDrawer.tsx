import React, { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  Divider,
  Stack,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  Link,
  LinearProgress,
  Tooltip,
} from '@mui/material';
import {
  Close as CloseIcon,
  OpenInNew as OpenInNewIcon,
  InfoOutlined as InfoIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
} from '@mui/icons-material';

interface StockInsightDrawerProps {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  symbol?: string;
  insights?: any | null;
}

type SparkWindow = '30D' | '90D';

const formatCurrency = (value?: number | null) => {
  if (value === undefined || value === null) return '-';
  if (Math.abs(value) >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toFixed(2)}`;
};

const formatPercent = (value?: number | null) => {
  if (value === undefined || value === null) return '-';
  return `${(value * 100).toFixed(2)}%`;
};

const formatNumber = (value?: number | null, digits = 2) => {
  if (value === undefined || value === null) return '-';
  return value.toFixed(digits);
};

const StockInsightDrawer: React.FC<StockInsightDrawerProps> = ({
  open,
  onClose,
  loading,
  symbol,
  insights,
}) => {
  const { t } = useTranslation();
  const [sparkWindow, setSparkWindow] = useState<SparkWindow>('30D');
  const [valScore, setValScore] = useState<any | null>(null);
  const [valLoading, setValLoading] = useState(false);
  const [moatData, setMoatData] = useState<any | null>(null);
  const [moatLoading, setMoatLoading] = useState(false);

  useEffect(() => {
    if (!open || !symbol) return;
    setValScore(null);
    setValLoading(true);
    fetch(`/api/screener/symbol/${symbol}/valuation-score`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => setValScore(data))
      .catch(() => setValScore(null))
      .finally(() => setValLoading(false));

    setMoatData(null);
    setMoatLoading(true);
    fetch(`/api/screener/symbol/${symbol}/moat`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => setMoatData(data))
      .catch(() => setMoatData(null))
      .finally(() => setMoatLoading(false));
  }, [open, symbol]);

  const renderSparkline = (series?: Array<{ date: string; close: number }>) => {
    if (!series || series.length < 2) {
      return (
        <Box
          sx={{
            height: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {t('screener.stock_insights.noPriceSeries')}
          </Typography>
        </Box>
      );
    }

    const width = 440;
    const height = 80;
    const values = series
      .map(p => p.close)
      .filter((v): v is number => Number.isFinite(v));
    if (values.length < 2) {
      return (
        <Box
          sx={{
            height: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {t('screener.stock_insights.noPriceSeries')}
          </Typography>
        </Box>
      );
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;

    const points = values
      .map((v, i) => {
        const x = (i / (values.length - 1)) * width;
        const y = height - ((v - min) / span) * height;
        return `${x},${y}`;
      })
      .join(' ');

    const first = values[0] ?? 0;
    const last = values[values.length - 1] ?? 0;
    const up = last >= first;

    return (
      <Box
        sx={{
          p: 1,
          borderRadius: 1.5,
          bgcolor: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <svg
          width="100%"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          style={{ display: 'block' }}
        >
          <polyline
            fill="none"
            stroke={up ? '#34d399' : '#f87171'}
            strokeWidth="2"
            points={points}
          />
        </svg>
      </Box>
    );
  };

  const buildSignalChips = (
    insights: any
  ): Array<{
    label: string;
    color: 'success' | 'warning' | 'error' | 'default';
  }> => {
    const out: Array<{
      label: string;
      color: 'success' | 'warning' | 'error' | 'default';
    }> = [];
    const rsi = insights?.rsi_14;
    const fwdPe = insights?.forward_pe;
    const growth = insights?.revenue_growth;
    const vol = insights?.annual_volatility;

    if (typeof rsi === 'number') {
      if (rsi >= 70)
        out.push({
          label: t('screener.stock_insights.signals.rsiOverbought'),
          color: 'warning',
        });
      else if (rsi <= 30)
        out.push({
          label: t('screener.stock_insights.signals.rsiOversold'),
          color: 'success',
        });
      else
        out.push({
          label: t('screener.stock_insights.signals.rsiNeutral'),
          color: 'default',
        });
    }

    if (typeof fwdPe === 'number') {
      if (fwdPe > 40)
        out.push({
          label: t('screener.stock_insights.signals.highValuation'),
          color: 'warning',
        });
      else if (fwdPe < 20)
        out.push({
          label: t('screener.stock_insights.signals.reasonableValuation'),
          color: 'success',
        });
    }

    if (typeof growth === 'number') {
      if (growth > 0.2)
        out.push({
          label: t('screener.stock_insights.signals.highGrowth'),
          color: 'success',
        });
      else if (growth < 0)
        out.push({
          label: t('screener.stock_insights.signals.negativeGrowth'),
          color: 'error',
        });
    }

    if (typeof vol === 'number') {
      if (vol > 0.45)
        out.push({
          label: t('screener.stock_insights.signals.highVolatility'),
          color: 'warning',
        });
    }

    return out;
  };

  const recommendationBadges = useMemo(() => {
    if (!insights?.recommendations_summary) return [];

    // Flatten yfinance DataFrame-like objects: {"buy": {"0": 15}} -> ["buy", 15]
    return Object.entries(insights.recommendations_summary)
      .filter(([key]) => key !== 'period') // Usually 'period' is not a metric
      .map(([key, value]) => {
        let displayValue = value;
        if (value && typeof value === 'object' && '0' in value) {
          displayValue = (value as any)['0'];
        } else if (value && typeof value === 'object') {
          // Fallback: take first entry value if it's a generic object
          displayValue = Object.values(value)[0];
        }
        return [key, displayValue];
      });
  }, [insights]);

  const signalChips = buildSignalChips(insights);

  const sparkSeries = useMemo(() => {
    if (sparkWindow === '90D') return insights?.price_series_90d;
    return insights?.price_series_30d;
  }, [insights, sparkWindow]);

  // Combined news source check
  const displayNews = insights?.news || insights?.latest_news || [];

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', md: 540 },
          borderLeft: '1px solid rgba(129, 140, 248, 0.25)',
          background:
            'linear-gradient(180deg, rgba(12,15,30,0.96) 0%, rgba(10,12,24,0.98) 100%)',
        },
      }}
    >
      <Box
        sx={{
          p: 2,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box>
          <Typography variant="h6">
            {t('screener.stock_insights.title', { symbol: symbol || 'Stock' })}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('screener.stock_insights.subtitle')}
          </Typography>
        </Box>
        <IconButton onClick={onClose} aria-label={t('common.close')}>
          <CloseIcon />
        </IconButton>
      </Box>

      <Box sx={{ p: 2 }}>
        {loading ? (
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ py: 4, justifyContent: 'center' }}
          >
            <CircularProgress size={24} />
            <Typography color="text.secondary">
              {t('screener.stock_insights.loading')}
            </Typography>
          </Stack>
        ) : !insights ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <Typography color="text.secondary">
              {t('screener.stock_insights.empty')}
            </Typography>
          </Box>
        ) : (
          <Stack spacing={2.5}>
            {/* ─── Header card ─── */}
            <Card
              variant="outlined"
              sx={{
                border: '1px solid rgba(129, 140, 248, 0.2)',
                bgcolor: 'rgba(255,255,255,0.02)',
              }}
            >
              <CardContent>
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 700, color: 'primary.light' }}
                >
                  {insights.name || insights.symbol}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 1.5 }}
                >
                  {insights.sector || '-'} • {insights.industry || '-'}
                </Typography>
                <Typography
                  variant="h3"
                  sx={{
                    fontWeight: 800,
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {formatCurrency(insights.price)}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: 0.5 }}
                >
                  {t('common.updated')}: {insights.updated_at || '-'}
                </Typography>
                {signalChips.length > 0 && (
                  <Stack
                    direction="row"
                    spacing={1}
                    useFlexGap
                    flexWrap="wrap"
                    sx={{ mt: 2 }}
                  >
                    {signalChips.map((chip, idx) => (
                      <Chip
                        key={`${chip.label}-${idx}`}
                        label={chip.label}
                        size="small"
                        color={chip.color}
                        variant="outlined"
                        sx={{ fontWeight: 600 }}
                      />
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>

            {/* ─── Industry Valuation Score ─── */}
            {(valLoading || valScore) && (
              <Card
                variant="outlined"
                sx={{
                  border: '1px solid rgba(129, 140, 248, 0.25)',
                  bgcolor: 'rgba(79, 70, 229, 0.04)',
                  borderRadius: 2,
                }}
              >
                <CardContent>
                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    sx={{ mb: 1.5 }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {t('screener.stock_insights.industryValuation.title')}
                    </Typography>
                    <Tooltip
                      title={t(
                        'screener.stock_insights.industryValuation.subtitle'
                      )}
                      arrow
                    >
                      <InfoIcon
                        sx={{
                          fontSize: 14,
                          color: 'text.disabled',
                          cursor: 'help',
                        }}
                      />
                    </Tooltip>
                  </Stack>

                  {valLoading ? (
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      sx={{ py: 1 }}
                    >
                      <CircularProgress size={14} />
                      <Typography variant="caption" color="text.secondary">
                        Computing sector scores...
                      </Typography>
                    </Stack>
                  ) : valScore ? (
                    (() => {
                      const score: number = valScore.score ?? 0;
                      const label: string = valScore.label ?? '';
                      const colorMap: Record<string, string> = {
                        Undervalued: '#34d399',
                        Fair: '#63b3ed',
                        Elevated: '#fbbf24',
                        Expensive: '#f87171',
                      };
                      const color = colorMap[label] ?? '#94a3b8';
                      // SVG gauge arc
                      const radius = 36;
                      const cx = 48;
                      const cy = 48;
                      const circumference = Math.PI * radius;
                      const filled = (score / 100) * circumference;
                      return (
                        <Box>
                          <Stack
                            direction="row"
                            spacing={2}
                            alignItems="center"
                          >
                            {/* Gauge */}
                            <Box sx={{ flexShrink: 0 }}>
                              <svg width="96" height="56" viewBox="0 0 96 56">
                                {/* track */}
                                <path
                                  d={`M${cx - radius},${cy} A${radius},${radius} 0 0,1 ${cx + radius},${cy}`}
                                  fill="none"
                                  stroke="rgba(255,255,255,0.08)"
                                  strokeWidth="8"
                                  strokeLinecap="round"
                                />
                                {/* fill */}
                                <path
                                  d={`M${cx - radius},${cy} A${radius},${radius} 0 0,1 ${cx + radius},${cy}`}
                                  fill="none"
                                  stroke={color}
                                  strokeWidth="8"
                                  strokeLinecap="round"
                                  strokeDasharray={`${filled} ${circumference}`}
                                  style={{
                                    transition: 'stroke-dasharray 0.6s ease',
                                  }}
                                />
                                <text
                                  x={cx}
                                  y={cy - 4}
                                  textAnchor="middle"
                                  fill={color}
                                  fontSize="17"
                                  fontWeight="800"
                                  fontFamily="inherit"
                                >
                                  {Math.round(score)}
                                </text>
                              </svg>
                            </Box>
                            <Box>
                              <Chip
                                label={t(
                                  `screener.stock_insights.industryValuation.labels.${label}`,
                                  label
                                )}
                                size="small"
                                sx={{
                                  bgcolor: `${color}22`,
                                  color,
                                  border: `1px solid ${color}55`,
                                  fontWeight: 700,
                                  mb: 0.5,
                                }}
                              />
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                display="block"
                              >
                                {valScore.sector}
                              </Typography>
                              {valScore.low_confidence && (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: '#fbbf24',
                                    display: 'block',
                                    mt: 0.3,
                                  }}
                                >
                                  ⚠{' '}
                                  {t(
                                    'screener.stock_insights.industryValuation.lowConfidence'
                                  )}
                                </Typography>
                              )}
                            </Box>
                          </Stack>

                          {/* Sub-scores breakdown */}
                          {valScore.sub_scores &&
                            valScore.sub_scores.length > 0 && (
                              <Box sx={{ mt: 2 }}>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{
                                    fontWeight: 600,
                                    mb: 1,
                                    display: 'block',
                                  }}
                                >
                                  {t(
                                    'screener.stock_insights.industryValuation.metricsUsed'
                                  )}
                                </Typography>
                                <Stack spacing={0.8}>
                                  {valScore.sub_scores.map((sub: any) => (
                                    <Box key={sub.field}>
                                      <Stack
                                        direction="row"
                                        justifyContent="space-between"
                                        sx={{ mb: 0.3 }}
                                      >
                                        <Typography
                                          variant="caption"
                                          color="text.secondary"
                                        >
                                          {String(
                                            t(
                                              `screener.stock_insights.industryValuation.fields.${sub.field}`,
                                              { defaultValue: sub.field }
                                            )
                                          )}
                                        </Typography>
                                        <Typography
                                          variant="caption"
                                          sx={{
                                            fontWeight: 700,
                                            fontVariantNumeric: 'tabular-nums',
                                            color:
                                              sub.score >= 60
                                                ? '#34d399'
                                                : sub.score >= 40
                                                  ? '#fbbf24'
                                                  : '#f87171',
                                          }}
                                        >
                                          {Math.round(sub.score)}
                                        </Typography>
                                      </Stack>
                                      <LinearProgress
                                        variant="determinate"
                                        value={sub.score}
                                        sx={{
                                          height: 4,
                                          borderRadius: 2,
                                          bgcolor: 'rgba(255,255,255,0.06)',
                                          '& .MuiLinearProgress-bar': {
                                            bgcolor:
                                              sub.score >= 60
                                                ? '#34d399'
                                                : sub.score >= 40
                                                  ? '#fbbf24'
                                                  : '#f87171',
                                            borderRadius: 2,
                                          },
                                        }}
                                      />
                                    </Box>
                                  ))}
                                </Stack>
                              </Box>
                            )}
                        </Box>
                      );
                    })()
                  ) : null}
                </CardContent>
              </Card>
            )}

            <Box>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 1.2 }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {t('screener.stock_insights.priceTrend')}
                </Typography>
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={sparkWindow}
                  onChange={(_, v) => v && setSparkWindow(v)}
                >
                  <ToggleButton value="30D">30D</ToggleButton>
                  <ToggleButton value="90D">90D</ToggleButton>
                </ToggleButtonGroup>
              </Stack>
              {renderSparkline(sparkSeries)}
            </Box>

            <Grid container spacing={1.5}>
              {[
                {
                  label: t('screener.table.columns.marketCap'),
                  value: formatCurrency(insights.market_cap),
                },
                {
                  label: t('screener.table.columns.forwardPe'),
                  value: formatNumber(insights.forward_pe),
                },
                {
                  label: t('screener.table.columns.trailingPe'),
                  value: formatNumber(insights.trailing_pe),
                },
                {
                  label: t('screener.table.columns.pegRatio'),
                  value: formatNumber(insights.peg_ratio),
                },
                {
                  label: t('screener.table.columns.revenueGrowth'),
                  value: formatPercent(insights.revenue_growth),
                },
                {
                  label: t('screener.table.columns.epsGrowth'),
                  value: formatPercent(insights.eps_growth),
                },
                {
                  label: t('screener.table.columns.grossMargin'),
                  value: formatPercent(insights.gross_margin),
                },
                {
                  label: t('screener.table.columns.ebitdaMargin'),
                  value: formatPercent(insights.ebitda_margin),
                },
                {
                  label: t('screener.table.columns.oneMonthReturn'),
                  value: formatPercent(insights.one_month_return),
                },
                {
                  label: t('screener.table.columns.threeMonthReturn'),
                  value: formatPercent(insights.three_month_return),
                },
                {
                  label: t('screener.table.columns.rsi14'),
                  value: formatNumber(insights.rsi_14, 1),
                },
                {
                  label: t('screener.table.columns.annualVolatility'),
                  value: formatPercent(insights.annual_volatility),
                },
              ].map((item, idx) => (
                <Grid item xs={6} key={idx}>
                  <Card
                    variant="outlined"
                    sx={{
                      bgcolor: 'transparent',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <CardContent sx={{ p: '12px !important' }}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                        gutterBottom
                      >
                        {item.label}
                      </Typography>
                      <Typography
                        variant="body1"
                        sx={{
                          fontWeight: 600,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {item.value}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            <Divider />

            {/* ─── Wall Street Deep Dive ─── */}
            <Box>
              <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{ mb: 0.5 }}
              >
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 800, color: 'primary.light' }}
                >
                  {t('screener.stock_insights.wallStreet.title')}
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('screener.stock_insights.wallStreet.subtitle')}
              </Typography>

              {moatLoading ? (
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{ py: 2 }}
                >
                  <CircularProgress size={16} />
                  <Typography variant="caption" color="text.secondary">
                    Loading deep dive analysis...
                  </Typography>
                </Stack>
              ) : moatData ? (
                <Stack spacing={2}>
                  {/* Panel A: Moat Quality Trends */}
                  {moatData.moat_trends &&
                    Object.keys(moatData.moat_trends.trend_direction || {})
                      .length > 0 && (
                      <Card
                        variant="outlined"
                        sx={{
                          bgcolor: 'rgba(255,255,255,0.01)',
                          border: '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                          <Typography
                            variant="subtitle2"
                            sx={{ fontWeight: 700, mb: 1.5 }}
                          >
                            {t(
                              'screener.stock_insights.wallStreet.panelA.title'
                            )}
                          </Typography>
                          <Stack spacing={1.5}>
                            {[
                              {
                                key: 'gross_margin',
                                label: t(
                                  'screener.stock_insights.wallStreet.panelA.grossMargin'
                                ),
                                data: moatData.moat_trends.gross_margin_trend,
                                dir: moatData.moat_trends.trend_direction
                                  .gross_margin,
                              },
                              {
                                key: 'fcf_margin',
                                label: t(
                                  'screener.stock_insights.wallStreet.panelA.fcfMargin'
                                ),
                                data: moatData.moat_trends.fcf_margin_trend,
                                dir: moatData.moat_trends.trend_direction
                                  .fcf_margin,
                              },
                              {
                                key: 'roic',
                                label: t(
                                  'screener.stock_insights.wallStreet.panelA.roic'
                                ),
                                data: moatData.moat_trends.roic_trend,
                                dir: moatData.moat_trends.trend_direction.roic,
                              },
                            ].map(metric => {
                              if (!metric.data || metric.data.length === 0)
                                return null;
                              const latest =
                                metric.data[metric.data.length - 1].value;
                              const Icon =
                                metric.dir === 'improving'
                                  ? TrendingUpIcon
                                  : metric.dir === 'declining'
                                    ? TrendingDownIcon
                                    : TrendingFlatIcon;
                              const color =
                                metric.dir === 'improving'
                                  ? '#34d399'
                                  : metric.dir === 'declining'
                                    ? '#f87171'
                                    : '#94a3b8';
                              return (
                                <Stack
                                  key={metric.key}
                                  direction="row"
                                  alignItems="center"
                                  justifyContent="space-between"
                                >
                                  <Box>
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                      display="block"
                                    >
                                      {metric.label}
                                    </Typography>
                                    <Typography
                                      variant="body2"
                                      sx={{
                                        fontWeight: 700,
                                        fontVariantNumeric: 'tabular-nums',
                                      }}
                                    >
                                      {latest !== null
                                        ? formatPercent(latest)
                                        : '-'}
                                    </Typography>
                                  </Box>
                                  <Stack
                                    direction="row"
                                    alignItems="center"
                                    spacing={0.5}
                                  >
                                    <Typography
                                      variant="caption"
                                      sx={{ color, fontWeight: 700 }}
                                    >
                                      {t(
                                        `screener.stock_insights.wallStreet.panelA.${metric.dir}`
                                      )}
                                    </Typography>
                                    <Icon sx={{ fontSize: 16, color }} />
                                  </Stack>
                                </Stack>
                              );
                            })}
                          </Stack>
                        </CardContent>
                      </Card>
                    )}

                  {/* Panel B: Value Creation & Multiples */}
                  {moatData.wacc_spread && (
                    <Card
                      variant="outlined"
                      sx={{
                        bgcolor: 'rgba(255,255,255,0.01)',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                        <Typography
                          variant="subtitle2"
                          sx={{ fontWeight: 700, mb: 1.5 }}
                        >
                          {t('screener.stock_insights.wallStreet.panelB.title')}
                        </Typography>

                        <Box sx={{ mb: 2 }}>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            display="block"
                          >
                            {t(
                              'screener.stock_insights.wallStreet.panelB.waccSpread'
                            )}
                          </Typography>
                          <Stack
                            direction="row"
                            alignItems="center"
                            spacing={1}
                            sx={{ mt: 0.5 }}
                          >
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 700,
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {moatData.wacc_spread.roic !== null
                                ? formatPercent(moatData.wacc_spread.roic)
                                : '-'}{' '}
                              ROIC
                            </Typography>
                            <Typography variant="caption" color="text.disabled">
                              vs
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 700,
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {moatData.wacc_spread.wacc !== null
                                ? formatPercent(moatData.wacc_spread.wacc)
                                : '-'}{' '}
                              WACC
                            </Typography>
                          </Stack>
                          {moatData.wacc_spread.spread !== null && (
                            <Chip
                              size="small"
                              label={
                                moatData.wacc_spread.creating_value
                                  ? t(
                                      'screener.stock_insights.wallStreet.panelB.creatingValue'
                                    )
                                  : t(
                                      'screener.stock_insights.wallStreet.panelB.destroyingValue'
                                    )
                              }
                              sx={{
                                mt: 1,
                                height: 20,
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                bgcolor: moatData.wacc_spread.creating_value
                                  ? 'rgba(52, 211, 153, 0.1)'
                                  : 'rgba(248, 113, 113, 0.1)',
                                color: moatData.wacc_spread.creating_value
                                  ? '#34d399'
                                  : '#f87171',
                                border: 'none',
                              }}
                            />
                          )}
                        </Box>

                        <Divider
                          sx={{
                            my: 1.5,
                            borderColor: 'rgba(255,255,255,0.05)',
                          }}
                        />

                        <Box>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            display="block"
                            sx={{ mb: 0.5 }}
                          >
                            {t(
                              'screener.stock_insights.wallStreet.panelB.historicalPe'
                            )}
                          </Typography>
                          {moatData.historical_pe?.available ? (
                            <Stack
                              direction="row"
                              alignItems="center"
                              spacing={1.5}
                            >
                              <Typography
                                variant="h4"
                                sx={{
                                  fontWeight: 800,
                                  color:
                                    moatData.historical_pe.current_percentile <
                                    30
                                      ? '#34d399'
                                      : moatData.historical_pe
                                            .current_percentile > 70
                                        ? '#f87171'
                                        : '#fbbf24',
                                }}
                              >
                                {moatData.historical_pe.current_percentile}
                                <Typography
                                  component="span"
                                  variant="caption"
                                  sx={{ ml: 0.2 }}
                                >
                                  pct
                                </Typography>
                              </Typography>
                              <Box sx={{ flex: 1 }}>
                                <LinearProgress
                                  variant="determinate"
                                  value={
                                    moatData.historical_pe.current_percentile
                                  }
                                  sx={{
                                    height: 6,
                                    borderRadius: 3,
                                    bgcolor: 'rgba(255,255,255,0.08)',
                                    '& .MuiLinearProgress-bar': {
                                      bgcolor:
                                        moatData.historical_pe
                                          .current_percentile < 30
                                          ? '#34d399'
                                          : moatData.historical_pe
                                                .current_percentile > 70
                                            ? '#f87171'
                                            : '#fbbf24',
                                      borderRadius: 3,
                                    },
                                  }}
                                />
                                <Stack
                                  direction="row"
                                  justifyContent="space-between"
                                  sx={{ mt: 0.5 }}
                                >
                                  <Typography
                                    variant="caption"
                                    color="text.disabled"
                                  >
                                    Min {moatData.historical_pe.min}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ fontWeight: 700 }}
                                  >
                                    Cur {moatData.historical_pe.current_pe}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    color="text.disabled"
                                  >
                                    Max {moatData.historical_pe.max}
                                  </Typography>
                                </Stack>
                              </Box>
                            </Stack>
                          ) : (
                            <Typography variant="body2" color="text.disabled">
                              {t(
                                'screener.stock_insights.wallStreet.panelB.peNA'
                              )}
                            </Typography>
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  )}

                  {/* Panel C: Institutional Flow */}
                  {(moatData.insider?.available ||
                    moatData.analyst?.available) && (
                    <Card
                      variant="outlined"
                      sx={{
                        bgcolor: 'rgba(255,255,255,0.01)',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                        <Typography
                          variant="subtitle2"
                          sx={{ fontWeight: 700, mb: 1.5 }}
                        >
                          {t('screener.stock_insights.wallStreet.panelC.title')}
                        </Typography>

                        <Grid container spacing={2}>
                          <Grid item xs={6}>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              display="block"
                              sx={{ mb: 1 }}
                            >
                              {t(
                                'screener.stock_insights.wallStreet.panelC.insider'
                              )}
                            </Typography>
                            {moatData.insider?.available ? (
                              <Stack spacing={0.5}>
                                <Stack
                                  direction="row"
                                  justifyContent="space-between"
                                >
                                  <Typography variant="body2">
                                    {t(
                                      'screener.stock_insights.wallStreet.panelC.buys'
                                    )}
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    sx={{ fontWeight: 700, color: '#34d399' }}
                                  >
                                    {moatData.insider.recent_buys}
                                  </Typography>
                                </Stack>
                                <Stack
                                  direction="row"
                                  justifyContent="space-between"
                                >
                                  <Typography variant="body2">
                                    {t(
                                      'screener.stock_insights.wallStreet.panelC.sells'
                                    )}
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    sx={{ fontWeight: 700, color: '#f87171' }}
                                  >
                                    {moatData.insider.recent_sells}
                                  </Typography>
                                </Stack>
                                <Typography
                                  variant="caption"
                                  sx={{
                                    mt: 0.5,
                                    fontWeight: 700,
                                    color:
                                      moatData.insider.net_sentiment ===
                                      'bullish'
                                        ? '#34d399'
                                        : moatData.insider.net_sentiment ===
                                            'bearish'
                                          ? '#f87171'
                                          : '#94a3b8',
                                  }}
                                >
                                  {t(
                                    `screener.stock_insights.wallStreet.panelC.${moatData.insider.net_sentiment}`
                                  )}
                                </Typography>
                              </Stack>
                            ) : (
                              <Typography
                                variant="caption"
                                color="text.disabled"
                              >
                                {t(
                                  'screener.stock_insights.wallStreet.panelC.noActivity'
                                )}
                              </Typography>
                            )}
                          </Grid>

                          <Grid item xs={6}>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              display="block"
                              sx={{ mb: 1 }}
                            >
                              {t(
                                'screener.stock_insights.wallStreet.panelC.analyst'
                              )}
                            </Typography>
                            {moatData.analyst?.available ? (
                              <Stack spacing={0.5}>
                                <Stack
                                  direction="row"
                                  justifyContent="space-between"
                                >
                                  <Typography variant="body2">
                                    {t(
                                      'screener.stock_insights.wallStreet.panelC.upgrades'
                                    )}
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    sx={{ fontWeight: 700, color: '#34d399' }}
                                  >
                                    {moatData.analyst.recent_upgrades}
                                  </Typography>
                                </Stack>
                                <Stack
                                  direction="row"
                                  justifyContent="space-between"
                                >
                                  <Typography variant="body2">
                                    {t(
                                      'screener.stock_insights.wallStreet.panelC.downgrades'
                                    )}
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    sx={{ fontWeight: 700, color: '#f87171' }}
                                  >
                                    {moatData.analyst.recent_downgrades}
                                  </Typography>
                                </Stack>
                                <Typography
                                  variant="caption"
                                  sx={{
                                    mt: 0.5,
                                    fontWeight: 700,
                                    color:
                                      moatData.analyst.net_sentiment ===
                                      'bullish'
                                        ? '#34d399'
                                        : moatData.analyst.net_sentiment ===
                                            'bearish'
                                          ? '#f87171'
                                          : '#94a3b8',
                                  }}
                                >
                                  {t(
                                    `screener.stock_insights.wallStreet.panelC.${moatData.analyst.net_sentiment}`
                                  )}
                                </Typography>
                              </Stack>
                            ) : (
                              <Typography
                                variant="caption"
                                color="text.disabled"
                              >
                                {t(
                                  'screener.stock_insights.wallStreet.panelC.noActivity'
                                )}
                              </Typography>
                            )}
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  )}
                </Stack>
              ) : null}
            </Box>

            <Divider />

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.8 }}>
                {t('screener.stock_insights.liquidity')}
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip
                  label={`Avg Vol(20D) ${formatNumber(insights.avg_volume_20d, 0)}`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={`Latest Vol ${formatNumber(insights.latest_volume, 0)}`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={`Vol Ratio ${formatNumber(insights.volume_ratio_20d, 2)}x`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={`Avg $Vol(20D) ${formatCurrency(insights.avg_dollar_volume_20d)}`}
                  size="small"
                  variant="outlined"
                />
              </Stack>
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.8 }}>
                {t('screener.stock_insights.analystTargets')}
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip
                  label={`Mean ${formatCurrency(insights.target_mean)}`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={`Low ${formatCurrency(insights.target_low)}`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={`High ${formatCurrency(insights.target_high)}`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={`Rec ${formatNumber(insights.recommendation_mean, 1)}`}
                  size="small"
                  variant="outlined"
                />
              </Stack>
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.8 }}>
                {t('screener.stock_insights.rangeEarnings')}
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip
                  label={`52W Low ${formatCurrency(insights.year_low)}`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={`52W High ${formatCurrency(insights.year_high)}`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={`To 52W High ${formatPercent(insights.distance_to_52w_high)}`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={`From 52W Low ${formatPercent(insights.distance_to_52w_low)}`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={`Next Earnings ${insights.next_earnings || '-'}`}
                  size="small"
                  variant="outlined"
                />
              </Stack>
            </Box>

            {recommendationBadges.length > 0 && (
              <Box>
                <Typography
                  variant="subtitle2"
                  sx={{ mb: 0.8, fontWeight: 700 }}
                >
                  {t('screener.stock_insights.recommendationMix')}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {recommendationBadges.map(([key, value]) => (
                    <Chip
                      key={String(key)}
                      label={`${key}: ${String(value)}`}
                      size="small"
                      variant="outlined"
                      sx={{
                        fontWeight: 600,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    />
                  ))}
                </Stack>
              </Box>
            )}

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
                {t('screener.stock_insights.latestNews')}
              </Typography>
              <Stack spacing={1.5}>
                {(displayNews || [])
                  .slice(0, 5)
                  .map((item: any, idx: number) => (
                    <Box
                      key={`${item.link || item.url}-${idx}`}
                      sx={{
                        p: 1.5,
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 2,
                        bgcolor: 'rgba(255,255,255,0.02)',
                        transition: 'border-color 0.2s ease',
                        '&:hover': { borderColor: 'rgba(129, 140, 248, 0.4)' },
                      }}
                    >
                      <Link
                        href={item.link || item.url}
                        target="_blank"
                        rel="noreferrer"
                        underline="hover"
                        color="inherit"
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                          mb: 0.5,
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 700, lineHeight: 1.4 }}
                        >
                          {item.title || item.headline}
                        </Typography>
                        <OpenInNewIcon
                          sx={{ fontSize: 14, color: 'primary.main' }}
                        />
                      </Link>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block' }}
                      >
                        {item.provider || item.source || t('common.unknown')}
                        {item.published_at || item.datetime
                          ? ` • ${item.published_at || item.datetime}`
                          : ''}
                      </Typography>
                    </Box>
                  ))}
                {(!displayNews || displayNews.length === 0) && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontStyle: 'italic', py: 2 }}
                  >
                    {t('screener.stock_insights.noNews')}
                  </Typography>
                )}
              </Stack>
            </Box>
          </Stack>
        )}
      </Box>
    </Drawer>
  );
};

export default StockInsightDrawer;
