/**
 * Cumulative Return Chart
 * Displays portfolio vs benchmark performance over time.
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
  }[];
}

// Color palette for benchmarks
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

  // Add benchmark returns
  for (const benchmark of benchmarks) {
    for (const point of benchmark.dailyReturns) {
      const existing = dateMap.get(point.date) || { date: point.date };
      existing[benchmark.symbol] = point.cumulativeReturn * 100;
      dateMap.set(point.date, existing);
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
            formatter={(value: number, name: string) => [
              `${value.toFixed(2)}%`,
              name === 'portfolio' ? 'Your Portfolio' : name,
            ]}
            labelFormatter={label => `Date: ${label}`}
          />
          <Legend />

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
            stroke="#2dd4bf" // Teal 400
            strokeWidth={2}
            dot={false}
            strokeDasharray="4 4" // Dashed line
            connectNulls={true}
          />

          {/* Benchmark lines */}
          {benchmarks.map(benchmark => (
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
              strokeDasharray="5 5"
              connectNulls={true}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
};
