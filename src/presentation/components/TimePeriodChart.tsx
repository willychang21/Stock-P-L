import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Box, Typography } from '@mui/material';
import { PeriodStats } from '@application/services/PLService';

export type ChartType = 'bar' | 'line' | 'area';

interface TimePeriodChartProps {
  data: PeriodStats[];
  chartType: ChartType;
}

// Convert Decimal to number for recharts
interface ChartData {
  period: string;
  realizedPL: number;
  tradeCount: number;
  winRate: number;
}

export const TimePeriodChart: React.FC<TimePeriodChartProps> = ({
  data,
  chartType,
}) => {
  // Convert PeriodStats to chart-friendly format
  const chartData: ChartData[] = data.map(d => ({
    period: d.period,
    realizedPL: d.realizedPL.toNumber(),
    tradeCount: d.tradeCount,
    winRate: d.winRate,
  }));

  if (chartData.length === 0) {
    return (
      <Box
        sx={{
          height: 300,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography color="text.secondary">
          No data available for the selected period
        </Typography>
      </Box>
    );
  }

  const commonProps = {
    data: chartData,
    margin: { top: 20, right: 30, left: 20, bottom: 5 },
  };

  const renderChart = () => {
    switch (chartType) {
      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.1)"
            />
            <XAxis
              dataKey="period"
              stroke="#a1a1aa"
              fontSize={12}
              tick={{ fill: '#a1a1aa' }}
            />
            <YAxis
              tickFormatter={value => `$${value.toLocaleString()}`}
              stroke="#a1a1aa"
              fontSize={12}
              tick={{ fill: '#a1a1aa' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(9, 9, 11, 0.95)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#fafafa',
              }}
              formatter={(value: number) => [
                `$${value.toFixed(2)}`,
                'Realized P/L',
              ]}
            />
            <Legend wrapperStyle={{ color: '#a1a1aa' }} />
            <Bar
              dataKey="realizedPL"
              name="Realized P/L"
              fill="#818cf8"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        );

      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.1)"
            />
            <XAxis
              dataKey="period"
              stroke="#a1a1aa"
              fontSize={12}
              tick={{ fill: '#a1a1aa' }}
            />
            <YAxis
              tickFormatter={value => `$${value.toLocaleString()}`}
              stroke="#a1a1aa"
              fontSize={12}
              tick={{ fill: '#a1a1aa' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(9, 9, 11, 0.95)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#fafafa',
              }}
              formatter={(value: number) => [
                `$${value.toFixed(2)}`,
                'Realized P/L',
              ]}
            />
            <Legend wrapperStyle={{ color: '#a1a1aa' }} />
            <Line
              type="monotone"
              dataKey="realizedPL"
              name="Realized P/L"
              stroke="#818cf8"
              strokeWidth={2}
              dot={{ fill: '#818cf8' }}
            />
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.1)"
            />
            <XAxis
              dataKey="period"
              stroke="#a1a1aa"
              fontSize={12}
              tick={{ fill: '#a1a1aa' }}
            />
            <YAxis
              tickFormatter={value => `$${value.toLocaleString()}`}
              stroke="#a1a1aa"
              fontSize={12}
              tick={{ fill: '#a1a1aa' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(9, 9, 11, 0.95)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#fafafa',
              }}
              formatter={(value: number) => [
                `$${value.toFixed(2)}`,
                'Realized P/L',
              ]}
            />
            <Legend wrapperStyle={{ color: '#a1a1aa' }} />
            <Area
              type="monotone"
              dataKey="realizedPL"
              name="Realized P/L"
              stroke="#818cf8"
              fill="#818cf8"
              fillOpacity={0.3}
            />
          </AreaChart>
        );
    }
  };

  return (
    <Box sx={{ width: '100%', height: 350 }}>
      <ResponsiveContainer width="100%" height="100%">
        {renderChart()}
      </ResponsiveContainer>
    </Box>
  );
};
