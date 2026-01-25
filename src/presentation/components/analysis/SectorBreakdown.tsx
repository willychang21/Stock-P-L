import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  LinearProgress,
  Chip,
  useTheme,
  Divider,
} from '@mui/material';
import { Holding } from '../../../domain/models/Holding';
import Decimal from 'decimal.js';

interface SectorBreakdownProps {
  holdings: Holding[];
}

interface SectorStats {
  name: string;
  value: Decimal;
  pl: Decimal;
  symbols: string[];
  percentage: number;
}

export const SectorBreakdown: React.FC<SectorBreakdownProps> = ({
  holdings,
}) => {
  const theme = useTheme();

  // Aggregate data by sector
  const totalValue = holdings.reduce(
    (sum, h) => sum.plus(h.marketValue),
    new Decimal(0)
  );

  const sectorMap = new Map<string, SectorStats>();

  holdings.forEach(h => {
    const sector = h.fundamentals?.sector || 'Unknown';
    if (!sectorMap.has(sector)) {
      sectorMap.set(sector, {
        name: sector,
        value: new Decimal(0),
        pl: new Decimal(0),
        symbols: [],
        percentage: 0,
      });
    }
    const stats = sectorMap.get(sector)!;
    stats.value = stats.value.plus(h.marketValue);
    stats.pl = stats.pl.plus(h.unrealizedPL); // Using Unrealized PL for now
    stats.symbols.push(h.symbol);
  });

  const sectors = Array.from(sectorMap.values())
    .map(s => ({
      ...s,
      percentage: totalValue.gt(0)
        ? s.value.div(totalValue).times(100).toNumber()
        : 0,
    }))
    .sort((a, b) => b.value.minus(a.value).toNumber())
    .filter(s => s.percentage > 0.1); // Filter < 0.1%

  return (
    <Card
      sx={{
        height: '100%',
        background: 'rgba(24, 24, 27, 0.6)',
        backdropFilter: 'blur(12px)',
        borderRadius: 4,
        border: '1px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      <CardContent>
        <Typography
          variant="h6"
          gutterBottom
          sx={{ fontWeight: 700, color: 'text.primary' }}
        >
          Sector Allocation
        </Typography>
        <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.1)' }} />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {sectors.map(sector => (
            <Box key={sector.name}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  mb: 1,
                  alignItems: 'center',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 600, color: 'text.primary' }}
                  >
                    {sector.name}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary' }}
                  >
                    ({sector.symbols.length} stocks)
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {sector.percentage.toFixed(1)}%
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: sector.pl.gte(0) ? '#4ade80' : '#f87171',
                      fontWeight: 600,
                    }}
                  >
                    {sector.pl.gte(0) ? '+' : ''}${sector.pl.toFixed(2)}
                  </Typography>
                </Box>
              </Box>
              <LinearProgress
                variant="determinate"
                value={sector.percentage}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  bgcolor: 'rgba(255,255,255,0.05)',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: getSectorColor(sector.name),
                    borderRadius: 3,
                  },
                }}
              />
              <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {sector.symbols.slice(0, 5).map(sym => (
                  <Chip
                    key={sym}
                    label={sym}
                    size="small"
                    variant="outlined"
                    sx={{
                      height: 20,
                      fontSize: '0.65rem',
                      borderColor: 'rgba(255,255,255,0.1)',
                      color: 'text.secondary',
                    }}
                  />
                ))}
                {sector.symbols.length > 5 && (
                  <Chip
                    label={`+${sector.symbols.length - 5}`}
                    size="small"
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.65rem' }}
                  />
                )}
              </Box>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
};

// Helper for sector colors
const getSectorColor = (sector: string): string => {
  const colors: Record<string, string> = {
    Technology: '#3b82f6', // blue
    'Financial Services': '#22c55e', // green
    Healthcare: '#ef4444', // red
    'Consumer Cyclical': '#f97316', // orange
    'Communication Services': '#8b5cf6', // violet
    Industrials: '#64748b', // slate
    Energy: '#eab308', // yellow
    'Consumer Defensive': '#14b8a6', // teal
    'Real Estate': '#ec4899', // pink
    Utilities: '#6366f1', // indigo
    'Basic Materials': '#a855f7', // purple
  };
  return colors[sector] || '#71717a'; // zinc
};
