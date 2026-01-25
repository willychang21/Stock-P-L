/**
 * Cumulative Return Chart
 * Displays portfolio vs benchmark performance over time.
 * Now includes both Lump Sum and Same Timing benchmark lines.
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

interface ChartDataPoint {
  date: string;
  portfolio?: number;
  realized?: number;
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

// Color palette for benchmarks (Lump Sum - lighter/dashed)
const BENCHMARK_COLORS: { [key: string]: string } = {
  QQQ: '#00BCD4',
  SPY: '#FF9800',
  VOO: '#4CAF50',
  default: '#9C27B0',
};

// Color palette for Same Timing benchmarks (more saturated/solid)
const SAME_TIMING_COLORS: { [key: string]: string } = {
  QQQ: '#00ACC1', // Darker cyan
  SPY: '#F57C00', // Darker orange
  VOO: '#388E3C', // Darker green
  default: '#7B1FA2',
};

export const CumulativeReturnChart: React.FC<CumulativeReturnChartProps> = ({
  portfolioReturns,
  benchmarks,
}) => {
  // Merge all data points into unified chart data
  const chartData: ChartDataPoint[] = [];
  const dateMap = new Map<string, ChartDataPoint>();

  // Add portfolio returns
  for (const point of portfolioReturns) {
    dateMap.set(point.date, {
      date: point.date,
      portfolio: point.cumulativeReturn * 100, // Convert to percentage
      realized:
        point.realizedReturn !== undefined
          ? point.realizedReturn * 100
          : undefined,
    });
  }

  // Add benchmark returns (Lump Sum)
  for (const benchmark of benchmarks) {
    for (const point of benchmark.dailyReturns) {
      const existing = dateMap.get(point.date) || { date: point.date };
      existing[`${benchmark.symbol}_lumpsum`] = point.cumulativeReturn * 100;
      dateMap.set(point.date, existing);
    }

    // Add Same Timing returns
    if (benchmark.cashFlowWeightedDailyReturns) {
      for (const point of benchmark.cashFlowWeightedDailyReturns) {
        const existing = dateMap.get(point.date) || { date: point.date };
        existing[`${benchmark.symbol}_sametime`] = point.cumulativeReturn * 100;
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
          No performance data available
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
            formatter={(value: number, name: string) => {
              const displayName = name
                .replace('_lumpsum', ' (Lump Sum)')
                .replace('_sametime', ' (Same Timing)')
                .replace('portfolio', 'Your Portfolio')
                .replace('realized', 'Realized Return');
              return [`${value.toFixed(2)}%`, displayName];
            }}
            labelFormatter={label => `Date: ${label}`}
          />
          <Legend
            formatter={(value: string) => {
              return value
                .replace('_lumpsum', ' (Lump)')
                .replace('_sametime', ' (Same)');
            }}
          />

          {/* Portfolio line */}
          <Line
            type="monotone"
            dataKey="portfolio"
            name="Your Portfolio"
            stroke="#7C4DFF"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 6 }}
            connectNulls={true}
          />

          {/* Realized Return line */}
          <Line
            type="monotone"
            dataKey="realized"
            name="Realized Return"
            stroke="#2dd4bf"
            strokeWidth={2}
            dot={false}
            strokeDasharray="4 4"
            connectNulls={true}
          />

          {/* Benchmark lines - Lump Sum (dashed) */}
          {benchmarks.map(benchmark => (
            <Line
              key={`${benchmark.symbol}_lumpsum`}
              type="monotone"
              dataKey={`${benchmark.symbol}_lumpsum`}
              name={`${benchmark.symbol}_lumpsum`}
              stroke={
                BENCHMARK_COLORS[benchmark.symbol] || BENCHMARK_COLORS.default
              }
              strokeWidth={2}
              dot={false}
              strokeDasharray="5 5"
              connectNulls={true}
            />
          ))}

          {/* Benchmark lines - Same Timing (solid) */}
          {benchmarks
            .filter(
              b =>
                b.cashFlowWeightedDailyReturns &&
                b.cashFlowWeightedDailyReturns.length > 0
            )
            .map(benchmark => (
              <Line
                key={`${benchmark.symbol}_sametime`}
                type="monotone"
                dataKey={`${benchmark.symbol}_sametime`}
                name={`${benchmark.symbol}_sametime`}
                stroke={
                  SAME_TIMING_COLORS[benchmark.symbol] ||
                  SAME_TIMING_COLORS.default
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
