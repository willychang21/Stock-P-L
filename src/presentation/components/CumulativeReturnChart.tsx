/**
 * Cumulative Return Chart
 * Displays portfolio vs benchmark performance over time.
 * Simplified: Only shows Same Timing benchmark comparison.
 */

import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Box, Typography } from '@mui/material';
import { DailyReturn } from '@application/services/BenchmarkService';
import { useTranslation } from 'react-i18next';

interface ChartDataPoint {
  date: string;
  portfolio?: number;
  deposit?: number;
  [key: string]: string | number | undefined;
}

interface CumulativeReturnChartProps {
  portfolioReturns: DailyReturn[];
  benchmarks: {
    symbol: string;
    dailyReturns: DailyReturn[];
    cashFlowWeightedDailyReturns?: DailyReturn[];
  }[];
}

// Color palette for benchmarks (Same Timing)
const BENCHMARK_COLORS: { [key: string]: string } = {
  QQQ: '#00BCD4',
  SPY: '#FF9800',
  VOO: '#4CAF50',
  default: '#9C27B0',
};

export const CumulativeReturnChart: React.FC<CumulativeReturnChartProps> = ({
  portfolioReturns,
  benchmarks,
}) => {
  const { t } = useTranslation();

  // Merge all data points into unified chart data
  const chartData: ChartDataPoint[] = [];
  const dateMap = new Map<string, ChartDataPoint>();

  // Add portfolio returns
  for (const point of portfolioReturns) {
    dateMap.set(point.date, {
      date: point.date,
      portfolio: point.cumulativeReturn * 100, // Convert to percentage
      deposit: point.deposit, // Transfer amount
    });
  }

  // Add benchmark returns (Same Timing only)
  for (const benchmark of benchmarks) {
    if (benchmark.cashFlowWeightedDailyReturns) {
      for (const point of benchmark.cashFlowWeightedDailyReturns) {
        const existing = dateMap.get(point.date) || { date: point.date };
        existing[benchmark.symbol] = point.cumulativeReturn * 100;
        dateMap.set(point.date, existing);
      }
    }
  }

  // Sort by date
  const sortedDates = Array.from(dateMap.keys()).sort();
  for (const date of sortedDates) {
    chartData.push(dateMap.get(date)!);
  }

  if (chartData.length === 0) {
    return (
      <Box
        sx={{
          height: 400,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography color="text.secondary">
          {t('benchmark.chart.noPerformanceData')}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', height: 400 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#444" />
          <XAxis
            dataKey="date"
            stroke="#888"
            tick={{ fontSize: 12 }}
            tickFormatter={value => {
              const date = new Date(value);
              return `${date.getMonth() + 1}/${date.getDate()}`;
            }}
          />
          <YAxis
            stroke="#888"
            tickFormatter={value => `${value.toFixed(0)}%`}
            domain={['auto', 'auto']}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e1e1e',
              border: '1px solid #444',
              borderRadius: 8,
            }}
            formatter={(value: number, name: string, props: any) => {
              const displayName =
                name === 'portfolio'
                  ? t('benchmark.chart.yourPortfolio')
                  : name;

              const result = [`${value.toFixed(2)}%`, displayName];

              // Add deposit info if present
              if (props && props.payload && props.payload.deposit) {
                // Check if this is the portfolio line (to avoid duplicating for every line)
                if (name === 'portfolio') {
                  return [
                    <span style={{ display: 'block' }}>
                      {`${value.toFixed(2)}%`}
                      <br />
                      <span style={{ color: '#00C853', fontSize: '0.8em' }}>
                        {`+ $${props.payload.deposit.toLocaleString()}`}
                      </span>
                    </span>,
                    displayName,
                  ];
                }
              }
              return result;
            }}
            labelFormatter={label => `Date: ${label}`}
          />
          <Legend />

          {/* Portfolio line with Custom Dot for Deposits */}
          <Line
            type="monotone"
            dataKey="portfolio"
            name={t('benchmark.chart.yourPortfolio')}
            stroke="#7C4DFF"
            strokeWidth={3}
            activeDot={{ r: 6 }}
            connectNulls={true}
            dot={(props: any) => {
              const { cx, cy, payload } = props;
              if (payload && payload.deposit) {
                return (
                  <circle
                    key={payload.date}
                    cx={cx}
                    cy={cy}
                    r={5}
                    fill="#00C853" // Green for Money/Deposit
                    stroke="#fff"
                    strokeWidth={2}
                  />
                );
              }
              return <></>; // No dot for regular points
            }}
          />

          {/* Benchmark lines - Same Timing only (solid) */}
          {benchmarks
            .filter(
              b =>
                b.cashFlowWeightedDailyReturns &&
                b.cashFlowWeightedDailyReturns.length > 0
            )
            .map(benchmark => (
              <Line
                key={benchmark.symbol}
                type="monotone"
                dataKey={benchmark.symbol}
                name={benchmark.symbol}
                stroke={
                  BENCHMARK_COLORS[benchmark.symbol] || BENCHMARK_COLORS.default
                }
                strokeWidth={2}
                dot={false}
                connectNulls={true}
              />
            ))}
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
};
