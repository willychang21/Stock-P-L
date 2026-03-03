import React from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { ScreenerStock } from '../../../domain/models/ScreenerStock';

interface CompareDrawerProps {
  open: boolean;
  onClose: () => void;
  stocks: ScreenerStock[];
}

const metricRows: Array<{ key: keyof ScreenerStock; label: string; type: 'currency' | 'number' | 'percent' | 'text' }> = [
  { key: 'sector', label: 'Sector', type: 'text' },
  { key: 'price', label: 'Price', type: 'currency' },
  { key: 'market_cap', label: 'Market Cap', type: 'currency' },
  { key: 'forward_pe', label: 'Fwd P/E', type: 'number' },
  { key: 'trailing_pe', label: 'P/E', type: 'number' },
  { key: 'peg_ratio', label: 'PEG', type: 'number' },
  { key: 'price_to_fcf', label: 'P/FCF', type: 'number' },
  { key: 'roic', label: 'ROIC', type: 'percent' },
  { key: 'roe', label: 'ROE', type: 'percent' },
  { key: 'revenue_growth', label: 'Revenue Growth', type: 'percent' },
  { key: 'eps_growth', label: 'EPS Growth', type: 'percent' },
  { key: 'free_cash_flow', label: 'Free Cash Flow', type: 'currency' },
];

const formatCurrency = (value: number | undefined) => {
  if (value === undefined || value === null) return '-';
  if (Math.abs(value) >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toFixed(2)}`;
};

const formatValue = (value: any, type: 'currency' | 'number' | 'percent' | 'text') => {
  if (value === undefined || value === null) return '-';
  if (type === 'currency') return formatCurrency(value);
  if (type === 'percent') return `${(Number(value) * 100).toFixed(2)}%`;
  if (type === 'number') return Number(value).toFixed(2);
  return String(value);
};

const CompareDrawer: React.FC<CompareDrawerProps> = ({ open, onClose, stocks }) => {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', md: 760 },
          borderLeft: '1px solid rgba(129, 140, 248, 0.25)',
          background: 'linear-gradient(180deg, rgba(12,15,30,0.96) 0%, rgba(10,12,24,0.98) 100%)',
        },
      }}
    >
      <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6">Compare Stocks</Typography>
          <Typography variant="body2" color="text.secondary">{stocks.length} selected</Typography>
        </Box>
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Box>

      <Box sx={{ p: 2, overflowX: 'auto' }}>
        {stocks.length === 0 ? (
          <Typography color="text.secondary">Select 2-5 stocks in the table to compare.</Typography>
        ) : (
          <Table size="small" sx={{ minWidth: 680 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Metric</TableCell>
                {stocks.map(stock => (
                  <TableCell key={stock.symbol} align="right" sx={{ fontWeight: 700 }}>
                    <Chip size="small" label={stock.symbol} color="primary" variant="outlined" />
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {metricRows.map(row => (
                <TableRow key={String(row.key)}>
                  <TableCell>{row.label}</TableCell>
                  {stocks.map(stock => (
                    <TableCell key={`${stock.symbol}-${String(row.key)}`} align="right">
                      {formatValue(stock[row.key], row.type)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Box>
    </Drawer>
  );
};

export default CompareDrawer;
