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

interface PerformanceMetricsTableProps {
  data: BenchmarkComparisonResult;
}

export const PerformanceMetricsTable: React.FC<
  PerformanceMetricsTableProps
> = ({ data }) => {
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
            <TableCell>Metric</TableCell>
            <TableCell align="right">Your Portfolio</TableCell>
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
              <Typography fontWeight="medium">TWR Return</Typography>
              <Typography variant="caption" color="text.secondary">
                Time-Weighted Return (GIPS Standard)
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
              </TableCell>
            ))}
          </TableRow>

          {/* Alpha */}
          <TableRow>
            <TableCell>
              <Typography fontWeight="medium">Alpha</Typography>
              <Typography variant="caption" color="text.secondary">
                Excess return vs {data.benchmarks[0]?.symbol || 'benchmark'}
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

          {/* Simple Return */}
          <TableRow>
            <TableCell>
              <Typography fontWeight="medium">Simple Return</Typography>
              <Typography variant="caption" color="text.secondary">
                Including investment timing
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
              <Typography fontWeight="medium">Realized P/L</Typography>
              <Typography variant="caption" color="text.secondary">
                Profit/Loss from closed trades
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
              <Typography fontWeight="medium">Unrealized P/L</Typography>
              <Typography variant="caption" color="text.secondary">
                Paper value change of open positions
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
              <Typography fontWeight="medium">Total P/L</Typography>
              <Typography variant="caption" color="text.secondary">
                Dollar amount gained/lost
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
              <Typography fontWeight="medium">Period</Typography>
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
