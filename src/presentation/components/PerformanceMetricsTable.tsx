/**
 * Performance Metrics Table
 * Displays key performance metrics comparing portfolio to benchmarks.
 */

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Chip,
} from '@mui/material';
import { BenchmarkComparisonResult } from '@application/services/BenchmarkService';
import { useTranslation } from 'react-i18next';

interface PerformanceMetricsTableProps {
  data: BenchmarkComparisonResult;
}

export const PerformanceMetricsTable: React.FC<
  PerformanceMetricsTableProps
> = ({ data }) => {
  const { t } = useTranslation();

  const formatPercent = (value: number): string => {
    const pct = value * 100;
    const sign = pct > 0 ? '+' : '';
    return `${sign}${pct.toFixed(2)}%`;
  };

  const formatCurrency = (value: number): string => {
    const sign = value > 0 ? '+' : value < 0 ? '-' : '';
    return `${sign}$${Math.abs(value).toFixed(2)}`;
  };

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>{t('benchmark.metrics.metric')}</TableCell>
            <TableCell align="right">
              {t('benchmark.metrics.yourPortfolio')}
            </TableCell>
            {data.benchmarks.map(b => (
              <TableCell key={b.symbol} align="right">
                {b.symbol}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {/* TWR Return */}
          <TableRow>
            <TableCell>
              <Typography fontWeight="medium">
                {t('benchmark.metrics.twrReturn')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('benchmark.metrics.twrDesc')}
              </Typography>
            </TableCell>
            <TableCell align="right">
              <Typography
                fontWeight="bold"
                color={data.portfolio.twr >= 0 ? 'success.main' : 'error.main'}
                fontSize="1.1rem"
              >
                {formatPercent(data.portfolio.twr)}
              </Typography>
            </TableCell>
            {data.benchmarks.map(b => (
              <TableCell key={b.symbol} align="right">
                <Typography color={b.twr >= 0 ? 'success.main' : 'error.main'}>
                  {formatPercent(b.twr)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('benchmark.metrics.lumpSum')}
                </Typography>
              </TableCell>
            ))}
          </TableRow>

          {/* Cash-Flow Weighted Return - NEW! */}
          <TableRow sx={{ backgroundColor: 'rgba(99, 102, 241, 0.05)' }}>
            <TableCell>
              <Typography fontWeight="medium">
                {t('benchmark.metrics.sameTimingReturn')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('benchmark.metrics.sameTimingDesc')}
              </Typography>
            </TableCell>
            <TableCell align="right">
              <Typography
                fontWeight="bold"
                color={
                  data.portfolio.simpleReturn >= 0
                    ? 'success.main'
                    : 'error.main'
                }
                fontSize="1.1rem"
              >
                {formatPercent(data.portfolio.simpleReturn)}
              </Typography>
            </TableCell>
            {data.benchmarks.map(b => (
              <TableCell key={b.symbol} align="right">
                <Typography
                  fontWeight="bold"
                  color={
                    (b.cashFlowWeightedReturn || 0) >= 0
                      ? 'success.main'
                      : 'error.main'
                  }
                >
                  {formatPercent(b.cashFlowWeightedReturn || 0)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('benchmark.metrics.sameTiming')}
                </Typography>
              </TableCell>
            ))}
          </TableRow>

          {/* Alpha (Lump Sum) */}
          <TableRow>
            <TableCell>
              <Typography fontWeight="medium">
                {t('benchmark.metrics.alphaLumpSum')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('benchmark.metrics.alphaLumpSumDesc', {
                  benchmark: data.benchmarks[0]?.symbol || 'benchmark',
                })}
              </Typography>
            </TableCell>
            <TableCell align="right">
              <Chip
                label={formatPercent(data.alpha)}
                size="small"
                color={data.alpha >= 0 ? 'success' : 'error'}
                sx={{ fontWeight: 'bold' }}
              />
            </TableCell>
            {data.benchmarks.map(b => (
              <TableCell key={b.symbol} align="right">
                <Typography color="text.secondary">—</Typography>
              </TableCell>
            ))}
          </TableRow>

          {/* Alpha (Same Timing) - NEW! */}
          <TableRow sx={{ backgroundColor: 'rgba(99, 102, 241, 0.05)' }}>
            <TableCell>
              <Typography fontWeight="medium">
                {t('benchmark.metrics.alphaSameTiming')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('benchmark.metrics.alphaSameTimingDesc', {
                  benchmark: data.benchmarks[0]?.symbol || 'benchmark',
                })}
              </Typography>
            </TableCell>
            <TableCell align="right">
              <Chip
                label={formatPercent(data.cashFlowWeightedAlpha || 0)}
                size="small"
                color={
                  (data.cashFlowWeightedAlpha || 0) >= 0 ? 'success' : 'error'
                }
                sx={{ fontWeight: 'bold' }}
              />
            </TableCell>
            {data.benchmarks.map(b => (
              <TableCell key={b.symbol} align="right">
                <Typography color="text.secondary">—</Typography>
              </TableCell>
            ))}
          </TableRow>

          {/* Simple Return */}
          <TableRow>
            <TableCell>
              <Typography fontWeight="medium">
                {t('benchmark.metrics.simpleReturn')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('benchmark.metrics.simpleReturnDesc')}
              </Typography>
            </TableCell>
            <TableCell align="right">
              <Typography
                color={
                  data.portfolio.simpleReturn >= 0
                    ? 'success.main'
                    : 'error.main'
                }
              >
                {formatPercent(data.portfolio.simpleReturn)}
              </Typography>
            </TableCell>
            {data.benchmarks.map(b => (
              <TableCell key={b.symbol} align="right">
                <Typography color="text.secondary">—</Typography>
              </TableCell>
            ))}
          </TableRow>

          {/* Realized P/L */}
          <TableRow>
            <TableCell>
              <Typography fontWeight="medium">
                {t('benchmark.metrics.realizedPL')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('benchmark.metrics.realizedPLDesc')}
              </Typography>
            </TableCell>
            <TableCell align="right">
              <Typography
                fontWeight="bold"
                color={
                  data.portfolio.realizedPL.gte(0)
                    ? 'success.main'
                    : 'error.main'
                }
              >
                {formatCurrency(data.portfolio.realizedPL.toNumber())}
              </Typography>
            </TableCell>
            {data.benchmarks.map(b => (
              <TableCell key={b.symbol} align="right">
                <Typography color="text.secondary">—</Typography>
              </TableCell>
            ))}
          </TableRow>

          {/* Unrealized P/L */}
          <TableRow>
            <TableCell>
              <Typography fontWeight="medium">
                {t('benchmark.metrics.unrealizedPL')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('benchmark.metrics.unrealizedPLDesc')}
              </Typography>
            </TableCell>
            <TableCell align="right">
              <Typography
                fontWeight="bold"
                color={
                  data.portfolio.unrealizedPL.gte(0)
                    ? 'success.main'
                    : 'error.main'
                }
              >
                {formatCurrency(data.portfolio.unrealizedPL.toNumber())}
              </Typography>
            </TableCell>
            {data.benchmarks.map(b => (
              <TableCell key={b.symbol} align="right">
                <Typography color="text.secondary">—</Typography>
              </TableCell>
            ))}
          </TableRow>

          {/* Total P/L */}
          <TableRow>
            <TableCell>
              <Typography fontWeight="medium">
                {t('benchmark.metrics.totalPL')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('benchmark.metrics.totalPLDesc')}
              </Typography>
            </TableCell>
            <TableCell align="right">
              <Typography
                fontWeight="bold"
                color={
                  data.portfolio.totalPL.gte(0) ? 'success.main' : 'error.main'
                }
              >
                {formatCurrency(data.portfolio.totalPL.toNumber())}
              </Typography>
            </TableCell>
            {data.benchmarks.map(b => (
              <TableCell key={b.symbol} align="right">
                <Typography color="text.secondary">—</Typography>
              </TableCell>
            ))}
          </TableRow>

          {/* Period */}
          <TableRow>
            <TableCell>
              <Typography fontWeight="medium">
                {t('benchmark.metrics.period')}
              </Typography>
            </TableCell>
            <TableCell align="right" colSpan={data.benchmarks.length + 1}>
              <Typography variant="body2" color="text.secondary">
                {data.periodStart} → {data.periodEnd}
              </Typography>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );
};
