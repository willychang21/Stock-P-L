import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
} from '@mui/material';
import { Holding } from '../../../domain/models/Holding';
import { InfoOutlined } from '@mui/icons-material';

interface FundamentalGridProps {
  holdings: Holding[];
}

export const FundamentalGrid: React.FC<FundamentalGridProps> = ({
  holdings,
}) => {
  // Sort by Market Cap desc by default
  const sortedHoldings = [...holdings]
    .filter(h => h.fundamentals) // Only show items with data
    .sort(
      (a, b) =>
        (b.fundamentals?.marketCap || 0) - (a.fundamentals?.marketCap || 0)
    );

  const formatLargeNumber = (num?: number) => {
    if (!num) return '-';
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    return `$${num.toLocaleString()}`;
  };

  return (
    <Card
      sx={{
        width: '100%',
        mb: 4,
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
          Fundamental Analysis
        </Typography>

        <TableContainer
          component={Paper}
          elevation={0}
          sx={{ background: 'transparent' }}
        >
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: 'text.secondary' }}>Symbol</TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>
                  Sector / Industry
                </TableCell>
                <TableCell align="right" sx={{ color: 'text.secondary' }}>
                  Market Cap
                </TableCell>
                <TableCell align="right" sx={{ color: 'text.secondary' }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: 0.5,
                    }}
                  >
                    PE Ratio
                    <Tooltip title="Trailing PE Ratio">
                      <InfoOutlined fontSize="inherit" sx={{ fontSize: 14 }} />
                    </Tooltip>
                  </Box>
                </TableCell>
                <TableCell align="right" sx={{ color: 'text.secondary' }}>
                  Fwd PE
                </TableCell>
                <TableCell align="right" sx={{ color: 'text.secondary' }}>
                  Div Yield
                </TableCell>
                <TableCell align="right" sx={{ color: 'text.secondary' }}>
                  Beta
                </TableCell>
                <TableCell align="right" sx={{ color: 'text.secondary' }}>
                  52w High
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedHoldings.map(h => {
                const f = h.fundamentals!;
                const closeToHigh = f.fiftyTwoWeekHigh
                  ? h.currentPrice.toNumber() / f.fiftyTwoWeekHigh > 0.95
                  : false;

                return (
                  <TableRow
                    key={h.symbol}
                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                  >
                    <TableCell
                      component="th"
                      scope="row"
                      sx={{ fontWeight: 600, color: 'text.primary' }}
                    >
                      {h.symbol}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        <Typography
                          variant="body2"
                          sx={{ color: 'text.primary' }}
                        >
                          {f.sector}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ color: 'text.secondary', fontSize: '0.7rem' }}
                        >
                          {f.industry}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="right" sx={{ color: 'text.primary' }}>
                      {formatLargeNumber(f.marketCap)}
                    </TableCell>
                    <TableCell align="right" sx={{ color: 'text.primary' }}>
                      {f.peRatio ? f.peRatio.toFixed(2) : '-'}
                    </TableCell>
                    <TableCell align="right" sx={{ color: 'text.secondary' }}>
                      {f.forwardPE ? f.forwardPE.toFixed(2) : '-'}
                    </TableCell>
                    <TableCell align="right" sx={{ color: 'text.secondary' }}>
                      {f.dividendYield
                        ? `${(f.dividendYield * 100).toFixed(2)}%`
                        : '-'}
                    </TableCell>
                    <TableCell align="right" sx={{ color: 'text.secondary' }}>
                      {f.beta ? f.beta.toFixed(2) : '-'}
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        sx={{
                          color: closeToHigh ? '#4ade80' : 'text.secondary',
                          fontWeight: closeToHigh ? 700 : 400,
                        }}
                      >
                        {f.fiftyTwoWeekHigh
                          ? `$${f.fiftyTwoWeekHigh.toFixed(2)}`
                          : '-'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                );
              })}
              {sortedHoldings.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    align="center"
                    sx={{ py: 4, color: 'text.secondary' }}
                  >
                    No fundamental data available. Ensure backend is running and
                    internet is connected.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
};
