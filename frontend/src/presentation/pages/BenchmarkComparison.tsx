/**
 * Benchmark Comparison Page
 * Compare portfolio performance against market benchmarks using TWR.
 * Includes DCA (Dollar Cost Averaging) simulator.
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
  DCASettings,
  DCABenchmarkResult,
} from '@application/services/BenchmarkService';
import { useStore } from '@application/store/useStore';
import { useTranslation } from 'react-i18next';
import { CumulativeReturnChart } from '../components/CumulativeReturnChart';
import { PerformanceMetricsTable } from '../components/PerformanceMetricsTable';
import { DCASettingsPanel } from '../components/DCASettingsPanel';

type BenchmarkSelection = 'QQQ' | 'SPY' | 'VOO';

export const BenchmarkComparison: React.FC = () => {
  const [data, setData] = useState<BenchmarkComparisonResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBenchmarks, setSelectedBenchmarks] = useState<
    BenchmarkSelection[]
  >(['QQQ', 'SPY']);
  const lastRefresh = useStore(state => state.lastRefresh);
  const { t } = useTranslation();

  // DCA Simulator State
  const [dcaSettings, setDcaSettings] = useState<DCASettings>({
    frequency: 'monthly',
    amountPerInvestment: 500,
  });
  const [dcaResults, setDcaResults] = useState<DCABenchmarkResult[]>([]);
  const [dcaLoading, setDcaLoading] = useState(false);

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

  // DCA Simulation Handler
  const handleDCASimulate = async () => {
    if (!data) return;

    setDcaLoading(true);
    try {
      const results = await Promise.all(
        selectedBenchmarks.map(symbol =>
          benchmarkService.simulateDCA(
            symbol,
            dcaSettings,
            data.periodStart,
            data.periodEnd
          )
        )
      );
      setDcaResults(results);
    } catch (err) {
      console.error('DCA simulation failed:', err);
    } finally {
      setDcaLoading(false);
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
          {t('benchmark.title')}
        </Typography>
        <Alert severity="info">{t('benchmark.noData')}</Alert>
      </Box>
    );
  }

  // Alpha now uses cashFlowWeightedAlpha for fair comparison

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
        <Typography variant="h4">{t('benchmark.title')}</Typography>
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
        {/* Portfolio Return (Using Simple Return - Same Timing) */}
        <Card>
          <CardContent>
            <Typography color="text.secondary" variant="caption">
              {t('benchmark.yourPortfolio')}
            </Typography>
            <Typography
              variant="h4"
              color={
                data.portfolio.simpleReturn >= 0 ? 'success.main' : 'error.main'
              }
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              {data.portfolio.simpleReturn >= 0 ? (
                <TrendingUp />
              ) : (
                <TrendingDown />
              )}
              {(data.portfolio.simpleReturn * 100).toFixed(2)}%
            </Typography>
          </CardContent>
        </Card>

        {/* Primary Benchmark (Cash-Flow Weighted for fair comparison) */}
        {data.benchmarks[0] && (
          <Card>
            <CardContent>
              <Typography color="text.secondary" variant="caption">
                {data.benchmarks[0].symbol}
              </Typography>
              <Typography
                variant="h4"
                color={
                  data.benchmarks[0].cashFlowWeightedReturn >= 0
                    ? 'success.main'
                    : 'error.main'
                }
              >
                {(data.benchmarks[0].cashFlowWeightedReturn * 100).toFixed(2)}%
              </Typography>
            </CardContent>
          </Card>
        )}

        {/* Alpha (Cash-Flow Weighted) */}
        <Card>
          <CardContent>
            <Typography color="text.secondary" variant="caption">
              {t('benchmark.alpha')} (同時間)
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography
                variant="h4"
                color={
                  data.cashFlowWeightedAlpha >= 0
                    ? 'success.main'
                    : 'error.main'
                }
              >
                {data.cashFlowWeightedAlpha >= 0 ? '+' : ''}
                {(data.cashFlowWeightedAlpha * 100).toFixed(2)}%
              </Typography>
              <Chip
                label={
                  data.cashFlowWeightedAlpha >= 0
                    ? t('benchmark.beatMarket')
                    : t('benchmark.underperformed')
                }
                size="small"
                color={data.cashFlowWeightedAlpha >= 0 ? 'success' : 'error'}
              />
            </Box>
          </CardContent>
        </Card>

        {/* Total P/L */}
        <Card>
          <CardContent>
            <Typography color="text.secondary" variant="caption">
              {t('benchmark.totalPL')}
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
            {t('benchmark.cumulativeReturn')}
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
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('benchmark.performanceMetrics')}
          </Typography>
          <PerformanceMetricsTable data={data} />
        </CardContent>
      </Card>

      {/* DCA Simulator */}
      <DCASettingsPanel
        settings={dcaSettings}
        onSettingsChange={setDcaSettings}
        onSimulate={handleDCASimulate}
        loading={dcaLoading}
      />

      {/* DCA Results */}
      {dcaResults.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              📊 {t('benchmark.dcaSimulation')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('benchmark.dca.summary', {
                amount: dcaSettings.amountPerInvestment,
                frequency: dcaSettings.frequency,
                start: data.periodStart,
                end: data.periodEnd,
              })}
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 2,
              }}
            >
              {dcaResults.map(result => (
                <Card key={result.symbol} variant="outlined">
                  <CardContent>
                    <Typography variant="h6" color="primary">
                      {result.symbol}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('benchmark.totalInvested')}: $
                      {result.totalInvested.toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('benchmark.finalValue')}: $
                      {result.finalValue.toLocaleString()}
                    </Typography>
                    <Typography
                      variant="h5"
                      color={
                        result.totalReturn >= 0 ? 'success.main' : 'error.main'
                      }
                      sx={{ mt: 1 }}
                    >
                      {result.totalReturn >= 0 ? '+' : ''}
                      {(result.totalReturn * 100).toFixed(2)}%
                    </Typography>
                  </CardContent>
                </Card>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};
