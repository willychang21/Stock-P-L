import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
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

export const PerformanceAnalysis: React.FC = () => {
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [timeReport, setTimeReport] = useState<TimePerformanceReport | null>(
    null
  );
  const [loading, setLoading] = useState(true);
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
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Trade Performance Analysis
      </Typography>

      {/* Asset Type Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Overall" value="ALL" />
          <Tab label="Stocks" value="EQUITY" />
          <Tab label="ETFs" value="ETF" />
        </Tabs>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Win Rate
              </Typography>
              <Typography
                variant="h3"
                color={stats.winRate >= 50 ? 'success.main' : 'error.main'}
              >
                {stats.winRate.toFixed(1)}%
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                {stats.winCount} Wins / {stats.lossCount} Losses
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Realized P/L
              </Typography>
              <Typography
                variant="h3"
                color={
                  stats.totalRealized.gte(0) ? 'success.main' : 'error.main'
                }
              >
                ${stats.totalRealized.toFixed(2)}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                From {totalTrades} closed trades
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Profit Factor
              </Typography>
              <Typography variant="h3">
                {stats.profitFactor === Infinity
                  ? '∞'
                  : stats.profitFactor.toFixed(2)}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                Total Win / Total Loss
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Time-based Performance Section */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 2,
              mb: 2,
            }}
          >
            <Typography variant="h6">Performance by Period</Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <ToggleButtonGroup
                value={timePeriod}
                exclusive
                onChange={handleTimePeriodChange}
                size="small"
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

          <TimePeriodChart
            data={timeReport?.periods || []}
            chartType={chartType}
          />
        </CardContent>
      </Card>

      {/* Period Details Table */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Period Details
          </Typography>
          <TimePeriodTable data={timeReport?.periods || []} />
        </CardContent>
      </Card>

      {/* Detailed Stats */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Average Performance
              </Typography>
              <Divider sx={{ my: 1 }} />
              <Box
                sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}
              >
                <Typography>Average Win:</Typography>
                <Typography color="success.main">
                  ${stats.averageWin.toFixed(2)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography>Average Loss:</Typography>
                <Typography color="error.main">
                  ${stats.averageLoss.toFixed(2)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Totals
              </Typography>
              <Divider sx={{ my: 1 }} />
              <Box
                sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}
              >
                <Typography>Gross Profit:</Typography>
                <Typography color="success.main">
                  ${stats.totalWin.toFixed(2)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography>Gross Loss:</Typography>
                <Typography color="error.main">
                  ${stats.totalLoss.toFixed(2)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};
