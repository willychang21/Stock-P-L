import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Container,
  Tab,
  Tabs,
  CircularProgress,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { BarChart, ShowChart, StackedLineChart } from '@mui/icons-material';
import {
  plService,
  PerformanceReport,
  TradeStats,
  TimePeriod,
  AssetFilter,
  TimePerformanceReport,
} from '../../application/services/PLService';
import { useStore } from '../../application/store/useStore';
import { TimePeriodChart, ChartType } from '../components/TimePeriodChart';
import { TimePeriodTable } from '../components/TimePeriodTable';
import { BehavioralAnalytics } from '../components/BehavioralAnalytics';

export const PerformanceAnalysis: React.FC = () => {
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [timeReport, setTimeReport] = useState<TimePerformanceReport | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  // View Control
  const [viewTab, setViewTab] = useState(0); // 0: Performance

  // Performance Filters
  const [tabValue, setTabValue] = useState<AssetFilter>('ALL');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('yearly');
  const [chartType, setChartType] = useState<ChartType>('bar');

  const lastRefresh = useStore(state => state.lastRefresh);
  const costBasisMethod = useStore(state => state.costBasisMethod);

  useEffect(() => {
    loadData();
  }, [lastRefresh, tabValue, timePeriod, costBasisMethod]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [perfData, timeData] = await Promise.all([
        plService.getTradePerformance(costBasisMethod),
        plService.getPerformanceByTimePeriod(
          timePeriod,
          tabValue,
          costBasisMethod
        ),
      ]);
      setReport(perfData);
      setTimeReport(timeData);
    } catch (error) {
      console.error('Failed to load performance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: AssetFilter) => {
    setTabValue(newValue);
  };

  const handleTimePeriodChange = (
    _: React.MouseEvent<HTMLElement>,
    newPeriod: TimePeriod | null
  ) => {
    if (newPeriod) setTimePeriod(newPeriod);
  };

  const handleChartTypeChange = (
    _: React.MouseEvent<HTMLElement>,
    newType: ChartType | null
  ) => {
    if (newType) setChartType(newType);
  };

  const handleViewChange = (_: React.SyntheticEvent, newValue: number) => {
    setViewTab(newValue);
  };

  if (loading || !report) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const getStats = (): TradeStats => {
    if (tabValue === 'EQUITY') return report.byAssetType.EQUITY;
    if (tabValue === 'ETF') return report.byAssetType.ETF;
    return report.overall;
  };

  const stats = getStats();
  const totalTrades = stats.winCount + stats.lossCount;

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box
        sx={{
          mb: 4,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography
          variant="h4"
          component="h1"
          gutterBottom
          sx={{
            fontWeight: 700,
            textWrap: 'balance',
            color: 'text.primary',
          }}
        >
          Analysis & Research
        </Typography>
      </Box>

      {/* Main View Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 4 }}>
        <Tabs
          value={viewTab}
          onChange={handleViewChange}
          aria-label="analysis tabs"
        >
          <Tab label="Trade Performance" sx={{ fontWeight: 600 }} />
        </Tabs>
      </Box>

      {/* View 0: Trade Performance (Original View) */}
      {viewTab === 0 && (
        <>
          {/* Control Bar */}
          <Card
            sx={{
              mb: 4,
            }}
          >
            <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
              <Tabs
                value={tabValue}
                onChange={handleTabChange}
                sx={{
                  '& .MuiTab-root': {
                    color: 'text.secondary',
                    transition: 'all 0.2s',
                    '&.Mui-selected': { color: 'primary.main' },
                    '&:hover': { color: 'text.primary' },
                  },
                  '& .MuiTabs-indicator': { backgroundColor: 'primary.main' },
                }}
              >
                <Tab label="Overall" value="ALL" sx={{ fontWeight: 600 }} />
                <Tab label="Stocks" value="EQUITY" sx={{ fontWeight: 600 }} />
                <Tab label="ETFs" value="ETF" sx={{ fontWeight: 600 }} />
              </Tabs>
            </CardContent>
          </Card>

          {/* Summary KPI Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {[
              {
                title: 'Win Rate',
                value: `${stats.winRate.toFixed(1)}%`,
                subtext: `${stats.winCount} Wins / ${stats.lossCount} Losses`,
                color: stats.winRate >= 50 ? '#4ade80' : '#f87171', // Green 400 : Red 400
                trend: 'High Win Rate',
              },
              {
                title: 'Total Realized P/L',
                value: `$${stats.totalRealized.toFixed(2)}`,
                subtext: `From ${totalTrades} closed trades`,
                color: stats.totalRealized.gte(0) ? '#4ade80' : '#f87171',
                trend: 'Net Profit',
              },
              {
                title: 'Profit Factor',
                value:
                  stats.profitFactor === Infinity
                    ? '∞'
                    : stats.profitFactor.toFixed(2),
                subtext: 'Total Win / Total Loss',
                color: '#38bdf8', // Sky 400
                trend: 'Risk/Reward',
              },
            ].map((card, index) => (
              <Grid item xs={12} md={4} key={index}>
                <Card
                  sx={{
                    height: '100%',
                    transition: 'transform 0.2s ease-in-out, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow:
                        '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                    },
                  }}
                >
                  <CardContent>
                    <Typography
                      color="text.secondary"
                      variant="subtitle2"
                      sx={{
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                      gutterBottom
                    >
                      {card.title}
                    </Typography>
                    <Typography
                      variant="h3"
                      sx={{
                        color: card.color,
                        fontWeight: 800,
                        fontVariantNumeric: 'tabular-nums',
                        mb: 1,
                        textShadow: `0 0 20px ${card.color}40`, // Glow effect
                      }}
                    >
                      {card.value}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: 'text.secondary' }}
                    >
                      {card.subtext}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Time-based Performance Section */}
          <Card
            sx={{
              mb: 4,
            }}
          >
            <CardContent>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 2,
                  mb: 3,
                }}
              >
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 700, color: 'text.primary' }}
                >
                  Performance by Period
                </Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <ToggleButtonGroup
                    value={timePeriod}
                    exclusive
                    onChange={handleTimePeriodChange}
                    size="small"
                    sx={{
                      backgroundColor: 'rgba(0,0,0,0.2)',
                      '& .MuiToggleButton-root': {
                        color: 'text.secondary',
                        border: '1px solid rgba(255,255,255,0.05)',
                        '&.Mui-selected': {
                          backgroundColor: 'rgba(99, 102, 241, 0.1)', // Primary tint
                          color: 'primary.main',
                        },
                      },
                    }}
                  >
                    <ToggleButton value="yearly">Yearly</ToggleButton>
                    <ToggleButton value="quarterly">Quarterly</ToggleButton>
                    <ToggleButton value="monthly">Monthly</ToggleButton>
                  </ToggleButtonGroup>

                  <ToggleButtonGroup
                    value={chartType}
                    exclusive
                    onChange={handleChartTypeChange}
                    size="small"
                    sx={{
                      backgroundColor: 'rgba(0,0,0,0.2)',
                      '& .MuiToggleButton-root': {
                        color: 'text.secondary',
                        border: '1px solid rgba(255,255,255,0.05)',
                        '&.Mui-selected': {
                          backgroundColor: 'rgba(99, 102, 241, 0.1)', // Primary tint
                          color: 'primary.main',
                        },
                      },
                    }}
                  >
                    <ToggleButton value="bar" aria-label="bar chart">
                      <BarChart />
                    </ToggleButton>
                    <ToggleButton value="line" aria-label="line chart">
                      <ShowChart />
                    </ToggleButton>
                    <ToggleButton value="area" aria-label="area chart">
                      <StackedLineChart />
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Box>
              </Box>

              <Box sx={{ pt: 1 }}>
                <TimePeriodChart
                  data={timeReport?.periods || []}
                  chartType={chartType}
                />
              </Box>
            </CardContent>
          </Card>

          {/* Period Details Table */}
          <Card
            sx={{
              mb: 4,
            }}
          >
            <CardContent>
              <Typography
                variant="h6"
                gutterBottom
                sx={{ fontWeight: 700, color: 'text.primary' }}
              >
                Period Details
              </Typography>
              <TimePeriodTable data={timeReport?.periods || []} />
            </CardContent>
          </Card>

          {/* Detailed Stats Cards */}
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card
                sx={{
                  height: '100%',
                  background: 'rgba(24, 24, 27, 0.6)',
                  backdropFilter: 'blur(12px)',
                  borderRadius: 4,
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <CardContent>
                  <Typography
                    variant="h6"
                    gutterBottom
                    sx={{ fontWeight: 700, color: 'text.primary' }}
                  >
                    Average Performance
                  </Typography>
                  <Divider
                    sx={{ my: 2, borderColor: 'rgba(255,255,255,0.1)' }}
                  />
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      mb: 2,
                    }}
                  >
                    <Typography color="#94a3b8">Average Win</Typography>
                    <Typography
                      sx={{
                        color: '#4ade80',
                        fontWeight: 600,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      ${stats.averageWin.toFixed(2)}
                    </Typography>
                  </Box>
                  <Box
                    sx={{ display: 'flex', justifyContent: 'space-between' }}
                  >
                    <Typography color="#94a3b8">Average Loss</Typography>
                    <Typography
                      sx={{
                        color: '#f87171',
                        fontWeight: 600,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      ${stats.averageLoss.toFixed(2)}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card
                sx={{
                  height: '100%',
                  background: 'rgba(24, 24, 27, 0.6)',
                  backdropFilter: 'blur(12px)',
                  borderRadius: 4,
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <CardContent>
                  <Typography
                    variant="h6"
                    gutterBottom
                    sx={{ fontWeight: 700, color: 'text.primary' }}
                  >
                    Totals
                  </Typography>
                  <Divider
                    sx={{ my: 2, borderColor: 'rgba(255,255,255,0.1)' }}
                  />
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      mb: 2,
                    }}
                  >
                    <Typography color="text.secondary">Gross Profit</Typography>
                    <Typography
                      sx={{
                        color: '#4ade80',
                        fontWeight: 600,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      ${stats.totalWin.toFixed(2)}
                    </Typography>
                  </Box>
                  <Box
                    sx={{ display: 'flex', justifyContent: 'space-between' }}
                  >
                    <Typography color="text.secondary">Gross Loss</Typography>
                    <Typography
                      sx={{
                        color: '#f87171',
                        fontWeight: 600,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      ${stats.totalLoss.toFixed(2)}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <BehavioralAnalytics />
        </>
      )}

      {/* View 1 and 2 Removed */}
    </Container>
  );
};
