import React, { useMemo, useState } from 'react';
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
} from '@mui/material';
import { Close as CloseIcon, OpenInNew as OpenInNewIcon } from '@mui/icons-material';

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

const renderSparkline = (series?: Array<{ date: string; close: number }>) => {
  if (!series || series.length < 2) {
    return (
      <Box sx={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="caption" color="text.secondary">No price series</Typography>
      </Box>
    );
  }

  const width = 440;
  const height = 80;
  const values = series.map(p => p.close).filter((v): v is number => Number.isFinite(v));
  if (values.length < 2) {
    return (
      <Box sx={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="caption" color="text.secondary">No price series</Typography>
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
    <Box sx={{
      p: 1,
      borderRadius: 1.5,
      bgcolor: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
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

const buildSignalChips = (insights: any): Array<{ label: string; color: 'success' | 'warning' | 'error' | 'default' }> => {
  const out: Array<{ label: string; color: 'success' | 'warning' | 'error' | 'default' }> = [];
  const rsi = insights?.rsi_14;
  const fwdPe = insights?.forward_pe;
  const growth = insights?.revenue_growth;
  const vol = insights?.annual_volatility;

  if (typeof rsi === 'number') {
    if (rsi >= 70) out.push({ label: 'RSI Overbought', color: 'warning' });
    else if (rsi <= 30) out.push({ label: 'RSI Oversold', color: 'success' });
    else out.push({ label: 'RSI Neutral', color: 'default' });
  }

  if (typeof fwdPe === 'number') {
    if (fwdPe > 40) out.push({ label: 'High Valuation', color: 'warning' });
    else if (fwdPe < 20) out.push({ label: 'Reasonable Valuation', color: 'success' });
  }

  if (typeof growth === 'number') {
    if (growth > 0.2) out.push({ label: 'High Growth', color: 'success' });
    else if (growth < 0) out.push({ label: 'Negative Growth', color: 'error' });
  }

  if (typeof vol === 'number') {
    if (vol > 0.45) out.push({ label: 'High Volatility', color: 'warning' });
  }

  return out;
};

const StockInsightDrawer: React.FC<StockInsightDrawerProps> = ({
  open,
  onClose,
  loading,
  symbol,
  insights,
}) => {
  const [sparkWindow, setSparkWindow] = useState<SparkWindow>('30D');

  const recommendationBadges = insights?.recommendations_summary
    ? Object.entries(insights.recommendations_summary)
    : [];
  const signalChips = buildSignalChips(insights);

  const sparkSeries = useMemo(() => {
    if (sparkWindow === '90D') return insights?.price_series_90d;
    return insights?.price_series_30d;
  }, [insights, sparkWindow]);

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
      <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6">{symbol || 'Stock'} Insights</Typography>
          <Typography variant="body2" color="text.secondary">
            Live yfinance snapshot
          </Typography>
        </Box>
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Box>

      <Box sx={{ p: 2 }}>
        {loading ? (
          <Stack direction="row" spacing={1} alignItems="center">
            <CircularProgress size={18} />
            <Typography>Loading live insights...</Typography>
          </Stack>
        ) : !insights ? (
          <Typography color="text.secondary">Click a symbol row to load yfinance insights.</Typography>
        ) : (
          <Stack spacing={2}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{insights.name || insights.symbol}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {insights.sector || '-'} • {insights.industry || '-'}
                </Typography>
                <Typography variant="h4" sx={{ mt: 1.2, fontWeight: 800 }}>
                  {formatCurrency(insights.price)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Updated: {insights.updated_at || '-'}
                </Typography>
                {signalChips.length > 0 && (
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1.2 }}>
                    {signalChips.map((chip, idx) => (
                      <Chip key={`${chip.label}-${idx}`} label={chip.label} size="small" color={chip.color} variant="outlined" />
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>

            <Box>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.8 }}>
                <Typography variant="subtitle2">Price Trend</Typography>
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

            <Grid container spacing={1.2}>
              <Grid item xs={6}>
                <Card><CardContent><Typography variant="caption">Market Cap</Typography><Typography>{formatCurrency(insights.market_cap)}</Typography></CardContent></Card>
              </Grid>
              <Grid item xs={6}>
                <Card><CardContent><Typography variant="caption">Fwd P/E</Typography><Typography>{formatNumber(insights.forward_pe)}</Typography></CardContent></Card>
              </Grid>
              <Grid item xs={6}>
                <Card><CardContent><Typography variant="caption">P/E</Typography><Typography>{formatNumber(insights.trailing_pe)}</Typography></CardContent></Card>
              </Grid>
              <Grid item xs={6}>
                <Card><CardContent><Typography variant="caption">PEG</Typography><Typography>{formatNumber(insights.peg_ratio)}</Typography></CardContent></Card>
              </Grid>
              <Grid item xs={6}>
                <Card><CardContent><Typography variant="caption">Revenue Growth</Typography><Typography>{formatPercent(insights.revenue_growth)}</Typography></CardContent></Card>
              </Grid>
              <Grid item xs={6}>
                <Card><CardContent><Typography variant="caption">EPS Growth</Typography><Typography>{formatPercent(insights.eps_growth)}</Typography></CardContent></Card>
              </Grid>
              <Grid item xs={6}>
                <Card><CardContent><Typography variant="caption">Gross Margin</Typography><Typography>{formatPercent(insights.gross_margin)}</Typography></CardContent></Card>
              </Grid>
              <Grid item xs={6}>
                <Card><CardContent><Typography variant="caption">EBITDA Margin</Typography><Typography>{formatPercent(insights.ebitda_margin)}</Typography></CardContent></Card>
              </Grid>
              <Grid item xs={6}>
                <Card><CardContent><Typography variant="caption">1M Return</Typography><Typography>{formatPercent(insights.one_month_return)}</Typography></CardContent></Card>
              </Grid>
              <Grid item xs={6}>
                <Card><CardContent><Typography variant="caption">3M Return</Typography><Typography>{formatPercent(insights.three_month_return)}</Typography></CardContent></Card>
              </Grid>
              <Grid item xs={6}>
                <Card><CardContent><Typography variant="caption">RSI(14)</Typography><Typography>{formatNumber(insights.rsi_14, 1)}</Typography></CardContent></Card>
              </Grid>
              <Grid item xs={6}>
                <Card><CardContent><Typography variant="caption">Annual Volatility</Typography><Typography>{formatPercent(insights.annual_volatility)}</Typography></CardContent></Card>
              </Grid>
            </Grid>

            <Divider />

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.8 }}>Liquidity (Trading Readiness)</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip label={`Avg Vol(20D) ${formatNumber(insights.avg_volume_20d, 0)}`} size="small" variant="outlined" />
                <Chip label={`Latest Vol ${formatNumber(insights.latest_volume, 0)}`} size="small" variant="outlined" />
                <Chip label={`Vol Ratio ${formatNumber(insights.volume_ratio_20d, 2)}x`} size="small" variant="outlined" />
                <Chip label={`Avg $Vol(20D) ${formatCurrency(insights.avg_dollar_volume_20d)}`} size="small" variant="outlined" />
              </Stack>
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.8 }}>Analyst Targets</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip label={`Mean ${formatCurrency(insights.target_mean)}`} size="small" variant="outlined" />
                <Chip label={`Low ${formatCurrency(insights.target_low)}`} size="small" variant="outlined" />
                <Chip label={`High ${formatCurrency(insights.target_high)}`} size="small" variant="outlined" />
                <Chip label={`Rec ${formatNumber(insights.recommendation_mean, 1)}`} size="small" variant="outlined" />
              </Stack>
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.8 }}>52W Range & Earnings</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip label={`52W Low ${formatCurrency(insights.year_low)}`} size="small" variant="outlined" />
                <Chip label={`52W High ${formatCurrency(insights.year_high)}`} size="small" variant="outlined" />
                <Chip label={`To 52W High ${formatPercent(insights.distance_to_52w_high)}`} size="small" variant="outlined" />
                <Chip label={`From 52W Low ${formatPercent(insights.distance_to_52w_low)}`} size="small" variant="outlined" />
                <Chip label={`Next Earnings ${insights.next_earnings || '-'}`} size="small" variant="outlined" />
              </Stack>
            </Box>

            {recommendationBadges.length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.8 }}>Recommendation Mix</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {recommendationBadges.map(([key, value]) => (
                    <Chip key={key} label={`${key}: ${String(value)}`} size="small" variant="outlined" />
                  ))}
                </Stack>
              </Box>
            )}

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.8 }}>Latest News</Typography>
              <Stack spacing={1}>
                {(insights.news || []).slice(0, 4).map((item: any, idx: number) => (
                  <Box key={`${item.link}-${idx}`} sx={{
                    p: 1,
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 1.5,
                    bgcolor: 'rgba(255,255,255,0.02)',
                  }}>
                    <Link href={item.link} target="_blank" rel="noreferrer" underline="hover" color="inherit" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.title}</Typography>
                      <OpenInNewIcon sx={{ fontSize: 14 }} />
                    </Link>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.3 }}>
                      {item.provider || 'Unknown'}{item.published_at ? ` • ${item.published_at}` : ''}
                    </Typography>
                  </Box>
                ))}
                {(!insights.news || insights.news.length === 0) && (
                  <Typography variant="caption" color="text.secondary">No recent news from yfinance.</Typography>
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
