import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  ScatterChart,
  Scatter,
  ZAxis,
} from 'recharts';
import { plService } from '@application/services/PLService';
import { BehavioralAnalytics as AnalyticsData } from '@infrastructure/api/client';
import { useTranslation } from 'react-i18next';

export const BehavioralAnalytics: React.FC = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    plService
      .getBehavioralAnalytics()
      .then(setData)
      .catch(err => {
        console.error(err);
        setError('Failed to load behavioral analytics');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data || data.trades.length === 0)
    return <Alert severity="info">No trades available for analysis.</Alert>;

  // 1. Holding Time Data
  const holdingData = [
    {
      name: t('behavioral.winnersClosed'),
      days: data.metrics.avgHoldingDaysWinners,
      count: data.metrics.totalWinners,
      color: '#4caf50',
    },
    {
      name: t('behavioral.losersClosed'),
      days: data.metrics.avgHoldingDaysLosers,
      count: data.metrics.totalLosers,
      color: '#f44336',
    },
    {
      name: t('behavioral.winnersHolding'),
      days: data.metrics.avgHoldingDaysWinnersOpen,
      count: data.metrics.openWinners,
      color: '#81c784', // Lighter green
    },
    {
      name: t('behavioral.losersHolding'),
      days: data.metrics.avgHoldingDaysLosersOpen,
      count: data.metrics.openLosers,
      color: '#e57373', // Lighter red
    },
  ];

  // 2. Histogram Data (P/L Distribution) - Combined Open & Closed
  // 2. Histogram Data (P/L Distribution) - Zero-Aligned
  const pls = data.trades.map(t => t.realizedPl);
  const minVal = Math.min(...pls);
  const maxVal = Math.max(...pls);

  // Calculate dynamic "nice" bin size
  const roughBinCount = 15;
  const rawRange = Math.max(maxVal - minVal, 10); // Ensure non-zero range
  let binSize = rawRange / roughBinCount;

  // Round to nice step (1, 2, 5, 10...)
  const power = Math.pow(10, Math.floor(Math.log10(binSize)));
  const normalized = binSize / power;
  if (normalized < 1.5) binSize = 1 * power;
  else if (normalized < 3.5) binSize = 2 * power;
  else if (normalized < 7.5) binSize = 5 * power;
  else binSize = 10 * power;

  // Generate bins aligned to 0
  const startBin = Math.floor(minVal / binSize);
  const endBin = Math.ceil(maxVal / binSize);

  const histogramBins: {
    min: number;
    max: number;
    name: number;
    range: string;
    openCount: number;
    closedCount: number;
  }[] = [];
  for (let i = startBin; i < endBin; i++) {
    const binMin = i * binSize;
    const binMax = (i + 1) * binSize;
    histogramBins.push({
      min: binMin,
      max: binMax,
      name: binMin, // Keep numeric for customized tick formatting if needed
      range: `${binMin >= 0 ? '+' : ''}${binMin} to ${binMax}`,
      openCount: 0,
      closedCount: 0,
    });
  }

  data.trades.forEach(t => {
    // Find which bin this trades belongs to
    const binIndex = Math.floor(t.realizedPl / binSize) - startBin;
    if (histogramBins[binIndex]) {
      if (t.status === 'OPEN') {
        histogramBins[binIndex].openCount++;
      } else {
        histogramBins[binIndex].closedCount++;
      }
    }
  });

  const histogramData = histogramBins.map(bin => ({
    name: bin.min, // Use bin start as x-axis value
    fullRange: bin.range,
    closedCount: bin.closedCount,
    openCount: bin.openCount,
    totalCount: bin.closedCount + bin.openCount,
    fill: bin.min >= 0 ? '#4ade80' : '#f87171', // Green 400 : Red 400
  }));

  const ratio =
    (data.metrics.avgHoldingDaysWinnersOpen || 0) /
    (data.metrics.avgHoldingDaysLosers || 1);

  return (
    <Box sx={{ mt: 4 }}>
      <Typography
        variant="h5"
        gutterBottom
        sx={{ fontWeight: 700, color: 'text.primary', mt: 6, mb: 3 }}
      >
        {t('behavioral.title')}{' '}
        <Typography
          component="span"
          variant="h6"
          sx={{ color: 'text.secondary', fontWeight: 400 }}
        >
          {t('behavioral.subtitle')}
        </Typography>
      </Typography>

      <Grid container spacing={3}>
        {/* Metric Card: Holding Efficiency */}
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              height: '100%',
              transition: 'transform 0.2s',
              '&:hover': { transform: 'translateY(-4px)' },
            }}
          >
            <CardContent>
              <Typography
                color="text.secondary"
                variant="subtitle2"
                gutterBottom
                sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                {t('behavioral.holdingTimeRatio')}
              </Typography>
              <Box
                sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}
              >
                <Typography
                  variant="h3"
                  sx={{
                    color: ratio > 1.5 ? '#4ade80' : '#f87171',
                    fontWeight: 800,
                    fontVariantNumeric: 'tabular-nums',
                    textShadow:
                      ratio > 1.5 ? '0 0 20px rgba(74, 222, 128, 0.3)' : 'none',
                  }}
                >
                  {ratio.toFixed(2)}x
                </Typography>
              </Box>

              <Typography variant="body2" sx={{ color: '#cbd5e1', mb: 2 }}>
                {t('behavioral.holdingTime', {
                  winnerDays: data.metrics.avgHoldingDaysWinnersOpen,
                  loserDays: data.metrics.avgHoldingDaysLosers,
                })}
              </Typography>

              <Alert
                severity={ratio > 2 ? 'success' : 'warning'}
                variant="outlined"
                sx={{
                  bgcolor: 'rgba(0,0,0,0.2)',
                  color: ratio > 2 ? '#86efac' : '#fdba74',
                  border: '1px solid rgba(255,255,255,0.1)',
                  '& .MuiAlert-icon': { color: 'inherit' },
                }}
              >
                {ratio > 2
                  ? t('behavioral.excellent')
                  : t('behavioral.actionNeeded')}
              </Alert>
            </CardContent>
          </Card>
        </Grid>

        {/* Metric Card: Paper vs Realized */}
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              height: '100%',
              transition: 'transform 0.2s',
              '&:hover': { transform: 'translateY(-4px)' },
            }}
          >
            <CardContent>
              <Typography
                color="text.secondary"
                variant="subtitle2"
                gutterBottom
                sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                {t('behavioral.outcomeExtremes')}
              </Typography>

              <Box
                sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}
              >
                <Box>
                  <Typography variant="body2" color="#94a3b8">
                    {t('behavioral.maxUnrealizedGain')}
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{
                      color: '#4ade80',
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    $
                    {Math.max(
                      ...data.trades
                        .filter(t => t.status === 'OPEN')
                        .map(t => t.realizedPl),
                      0
                    ).toFixed(2)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="#94a3b8">
                    {t('behavioral.maxRealizedLoss')}
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{
                      color: '#f87171',
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    $
                    {Math.min(
                      ...data.trades
                        .filter(t => t.status === 'CLOSED')
                        .map(t => t.realizedPl),
                      0
                    ).toFixed(2)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Chart: Holding Time Comparison */}
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              height: 450,
              // Theme handles glass styles
            }}
          >
            <CardContent sx={{ height: '100%' }}>
              <Typography
                variant="h6"
                gutterBottom
                sx={{ fontWeight: 700, color: 'text.primary' }}
              >
                {t('behavioral.avgHoldingTime')}
              </Typography>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart
                  data={holdingData}
                  layout="vertical"
                  margin={{ top: 20, right: 30, left: 40, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.1)"
                    horizontal={false}
                  />
                  <XAxis type="number" stroke="#a1a1aa" fontSize={12} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={100}
                    stroke="#a1a1aa"
                    fontSize={11}
                    tick={{ fill: '#a1a1aa' }}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{
                      backgroundColor: 'rgba(9, 9, 11, 0.95)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: '#fafafa',
                    }}
                  />
                  <Bar
                    dataKey="days"
                    name={t('behavioral.daysHeld')}
                    radius={[0, 4, 4, 0]}
                  >
                    {holdingData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Chart: P/L Distribution Histogram */}
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              height: 450,
              // Theme handles glass styles
            }}
          >
            <CardContent sx={{ height: '100%' }}>
              <Typography
                variant="h6"
                gutterBottom
                sx={{ fontWeight: 700, color: 'text.primary' }}
              >
                {t('behavioral.plDistribution')}
              </Typography>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart
                  data={histogramData}
                  margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.1)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    stroke="#a1a1aa"
                    fontSize={12}
                    tickFormatter={val =>
                      val >= 0 ? `$${val}` : `-$${Math.abs(val)}`
                    }
                  />
                  <YAxis allowDecimals={false} stroke="#a1a1aa" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(9, 9, 11, 0.95)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: '#fafafa',
                    }}
                    formatter={(value: any, name: string) => [value, name]}
                    labelFormatter={(label: any, payload: any) =>
                      payload[0]?.payload.fullRange
                        ? `Range: ${payload[0].payload.fullRange}`
                        : label
                    }
                  />
                  <ReferenceLine x={0} stroke="#64748b" />
                  <Legend wrapperStyle={{ color: '#a1a1aa' }} />
                  <Bar
                    dataKey="closedCount"
                    name={t('behavioral.closed')}
                    stackId="a"
                    fill="#818cf8" // Indigo 400
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="openCount"
                    name={t('behavioral.openPaper')}
                    stackId="a"
                    fill="#34d399" // Emerald 400
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Chart: MFE vs MAE (Execution Quality) */}
        <Grid item xs={12}>
          <Card
            sx={
              {
                // Theme handles glass styles
              }
            }
          >
            <CardContent>
              <Typography
                variant="h6"
                gutterBottom
                sx={{ fontWeight: 700, color: 'text.primary' }}
              >
                {t('behavioral.executionQuality')}
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                {t('behavioral.executionDesc')}
              </Typography>
              <ResponsiveContainer width="100%" height={400}>
                <ScatterChart
                  margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.1)"
                  />
                  <XAxis
                    type="number"
                    dataKey="mae"
                    name="MAE (Drawdown)"
                    unit="%"
                    tickFormatter={val => (val * 100).toFixed(0)}
                    stroke="#a1a1aa"
                    label={{
                      value: t('behavioral.charts.drawdownLabel'),
                      position: 'insideBottom',
                      offset: -10,
                      fill: '#a1a1aa',
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="mfe"
                    name="MFE (Peak)"
                    unit="%"
                    tickFormatter={val => (val * 100).toFixed(0)}
                    stroke="#a1a1aa"
                    label={{
                      value: t('behavioral.charts.potentialGainLabel'),
                      angle: -90,
                      position: 'insideLeft',
                      fill: '#a1a1aa',
                    }}
                  />
                  <ZAxis
                    type="number"
                    dataKey="efficiency"
                    range={[60, 400]}
                    name="Efficiency"
                  />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3', stroke: '#cbd5e1' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length || !payload[0])
                        return null;
                      const data = payload[0]?.payload;
                      if (!data) return null;
                      return (
                        <div
                          style={{
                            backgroundColor: 'rgba(9, 9, 11, 0.95)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            padding: '12px',
                            color: '#f8fafc',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
                          }}
                        >
                          <p
                            style={{
                              margin: 0,
                              fontWeight: 700,
                              color: 'text.primary',
                            }}
                          >
                            {data.symbol}
                          </p>
                          <div
                            style={{
                              marginTop: 8,
                              display: 'grid',
                              gridTemplateColumns: 'auto auto',
                              gap: '4px 12px',
                              fontSize: '0.875rem',
                            }}
                          >
                            <span style={{ color: '#94a3b8' }}>
                              {t('behavioral.charts.mfe')}:
                            </span>
                            <span
                              style={{
                                fontFamily: 'monospace',
                                textAlign: 'right',
                              }}
                            >
                              {(data.mfe * 100).toFixed(2)}%
                            </span>

                            <span style={{ color: '#94a3b8' }}>
                              {t('behavioral.charts.mae')}:
                            </span>
                            <span
                              style={{
                                fontFamily: 'monospace',
                                textAlign: 'right',
                              }}
                            >
                              {(data.mae * 100).toFixed(2)}%
                            </span>

                            <span style={{ color: '#94a3b8' }}>
                              {t('behavioral.efficiency')}:
                            </span>
                            <span
                              style={{
                                fontFamily: 'monospace',
                                textAlign: 'right',
                              }}
                            >
                              {(data.efficiency * 100).toFixed(1)}%
                            </span>

                            <span style={{ color: '#94a3b8' }}>
                              {t('behavioral.charts.pl')}:
                            </span>
                            <span
                              style={{
                                fontFamily: 'monospace',
                                textAlign: 'right',
                                color:
                                  data.realizedPl >= 0 ? '#4ade80' : '#f87171',
                              }}
                            >
                              ${data.realizedPl.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend
                    wrapperStyle={{ color: '#a1a1aa' }}
                    verticalAlign="top"
                    height={36}
                  />
                  <Scatter
                    name={t('behavioral.charts.winningTrades')}
                    data={data.trades.filter(t => t.realizedPl > 0)}
                    fill="#4ade80"
                    fillOpacity={0.7}
                    stroke="#22c55e"
                  />
                  <Scatter
                    name={t('behavioral.charts.losingTrades')}
                    data={data.trades.filter(t => t.realizedPl <= 0)}
                    fill="#f87171"
                    fillOpacity={0.7}
                    stroke="#ef4444"
                    shape="triangle"
                  />
                </ScatterChart>
              </ResponsiveContainer>
              <Typography
                variant="body2"
                align="center"
                sx={{ mt: 2, color: 'text.secondary', fontStyle: 'italic' }}
              >
                {t('behavioral.insight')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};
