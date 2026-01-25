/**
 * Benchmark Comparison Page
 * Compare portfolio performance against market benchmarks using TWR.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
  Chip,
  Alert,
} from '@mui/material';
import { TrendingUp, TrendingDown } from '@mui/icons-material';
import {
  benchmarkService,
  BenchmarkComparisonResult,
} from '@application/services/BenchmarkService';
import { useStore } from '@application/store/useStore';
import { CumulativeReturnChart } from '../components/CumulativeReturnChart';
import { PerformanceMetricsTable } from '../components/PerformanceMetricsTable';

type BenchmarkSelection = 'QQQ' | 'SPY' | 'VOO';

export const BenchmarkComparison: React.FC = () => {
  const [data, setData] = useState<BenchmarkComparisonResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBenchmarks, setSelectedBenchmarks] = useState<
    BenchmarkSelection[]
  >(['QQQ', 'SPY']);
  const lastRefresh = useStore(state => state.lastRefresh);

  // Memoize the load function to prevent unnecessary re-creation
  const loadData = useCallback(async (benchmarks: BenchmarkSelection[]) => {
    try {
      setLoading(true);
      setError(null);
      // BenchmarkService now fetches everything in parallel
      const result = await benchmarkService.compare(benchmarks);
      setData(result);
    } catch (err) {
      console.error('Failed to load benchmark comparison:', err);
      setError('Failed to load benchmark data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load data when lastRefresh or selectedBenchmarks change
  useEffect(() => {
    loadData(selectedBenchmarks);
  }, [lastRefresh, selectedBenchmarks, loadData]);

  const handleBenchmarkChange = (
    _: React.MouseEvent<HTMLElement>,
    newBenchmarks: BenchmarkSelection[]
  ) => {
    if (newBenchmarks.length > 0) {
      setSelectedBenchmarks(newBenchmarks);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!data || data.portfolio.dailyReturns.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Portfolio vs Benchmark
        </Typography>
        <Alert severity="info">
          No portfolio data available. Please import transactions first.
        </Alert>
      </Box>
    );
  }

  const isOutperforming = data.alpha > 0;

  return (
    <Box sx={{ p: 3 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Typography variant="h4">Portfolio vs Benchmark</Typography>
        <ToggleButtonGroup
          value={selectedBenchmarks}
          onChange={handleBenchmarkChange}
          size="small"
        >
          <ToggleButton value="QQQ">QQQ</ToggleButton>
          <ToggleButton value="SPY">SPY</ToggleButton>
          <ToggleButton value="VOO">VOO</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Summary Cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 2,
          mb: 3,
        }}
      >
        {/* Portfolio TWR */}
        <Card>
          <CardContent>
            <Typography color="text.secondary" variant="caption">
              Your Portfolio (TWR)
            </Typography>
            <Typography
              variant="h4"
              color={data.portfolio.twr >= 0 ? 'success.main' : 'error.main'}
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              {data.portfolio.twr >= 0 ? <TrendingUp /> : <TrendingDown />}
              {(data.portfolio.twr * 100).toFixed(2)}%
            </Typography>
          </CardContent>
        </Card>

        {/* Primary Benchmark */}
        {data.benchmarks[0] && (
          <Card>
            <CardContent>
              <Typography color="text.secondary" variant="caption">
                {data.benchmarks[0].symbol}
              </Typography>
              <Typography
                variant="h4"
                color={
                  data.benchmarks[0].twr >= 0 ? 'success.main' : 'error.main'
                }
              >
                {(data.benchmarks[0].twr * 100).toFixed(2)}%
              </Typography>
            </CardContent>
          </Card>
        )}

        {/* Alpha */}
        <Card>
          <CardContent>
            <Typography color="text.secondary" variant="caption">
              Alpha (Outperformance)
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography
                variant="h4"
                color={isOutperforming ? 'success.main' : 'error.main'}
              >
                {data.alpha >= 0 ? '+' : ''}
                {(data.alpha * 100).toFixed(2)}%
              </Typography>
              <Chip
                label={isOutperforming ? 'Beat Market' : 'Underperformed'}
                size="small"
                color={isOutperforming ? 'success' : 'error'}
              />
            </Box>
          </CardContent>
        </Card>

        {/* Total P/L */}
        <Card>
          <CardContent>
            <Typography color="text.secondary" variant="caption">
              Total P/L
            </Typography>
            <Typography
              variant="h4"
              color={
                data.portfolio.totalPL.gte(0) ? 'success.main' : 'error.main'
              }
            >
              {data.portfolio.totalPL.gte(0) ? '+' : ''}$
              {data.portfolio.totalPL.toFixed(2)}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Cumulative Return Chart */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Cumulative Return Over Time
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {data.periodStart} → {data.periodEnd}
          </Typography>
          <CumulativeReturnChart
            portfolioReturns={data.portfolio.dailyReturns}
            benchmarks={data.benchmarks}
          />
        </CardContent>
      </Card>

      {/* Performance Metrics Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Performance Metrics
          </Typography>
          <PerformanceMetricsTable data={data} />
        </CardContent>
      </Card>
    </Box>
  );
};
