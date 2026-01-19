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
} from '@mui/material';
import { plService, PerformanceReport, TradeStats } from '../../application/services/PLService';
import { useStore } from '../../application/store/useStore';

export const PerformanceAnalysis: React.FC = () => {
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0); // 0: Overall, 1: Stocks, 2: ETF
  const lastRefresh = useStore((state) => state.lastRefresh);

  useEffect(() => {
    loadData();
  }, [lastRefresh]);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await plService.getTradePerformance('FIFO');
      setReport(data);
    } catch (error) {
      console.error('Failed to load performance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  if (loading || !report) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const getStats = (): TradeStats => {
    if (tabValue === 1) return report.byAssetType.EQUITY;
    if (tabValue === 2) return report.byAssetType.ETF;
    return report.overall;
  };

  const stats = getStats();
  const totalTrades = stats.winCount + stats.lossCount;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Trade Performance Analysis
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Overall" />
          <Tab label="Stocks" />
          <Tab label="ETFs" />
        </Tabs>
      </Box>

      <Grid container spacing={3}>
        {/* Key Metrics Cards */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Win Rate
              </Typography>
              <Typography variant="h3" color={stats.winRate >= 50 ? 'success.main' : 'error.main'}>
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
                color={stats.totalRealized.gte(0) ? 'success.main' : 'error.main'}
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
                {stats.profitFactor.toFixed(2)}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                Total Win / Total Loss
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Detailed Stats */}
        <Grid item xs={12} md={6}>
            <Card>
                <CardContent>
                    <Typography variant="h6" gutterBottom>Average Performance</Typography>
                    <Divider sx={{ my: 1 }} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography>Average Win:</Typography>
                        <Typography color="success.main">${stats.averageWin.toFixed(2)}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography>Average Loss:</Typography>
                        <Typography color="error.main">${stats.averageLoss.toFixed(2)}</Typography>
                    </Box>
                </CardContent>
            </Card>
        </Grid>

        <Grid item xs={12} md={6}>
            <Card>
                <CardContent>
                    <Typography variant="h6" gutterBottom>Totals</Typography>
                    <Divider sx={{ my: 1 }} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography>Gross Profit:</Typography>
                        <Typography color="success.main">${stats.totalWin.toFixed(2)}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography>Gross Loss:</Typography>
                        <Typography color="error.main">${stats.totalLoss.toFixed(2)}</Typography>
                    </Box>
                </CardContent>
            </Card>
        </Grid>
      </Grid>
    </Box>
  );
};
