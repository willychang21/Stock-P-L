import React from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();

  const metricRows: Array<{ key: keyof ScreenerStock; label: string; type: 'currency' | 'number' | 'percent' | 'text' }> = [
    { key: 'sector', label: t('screener.table.columns.sector'), type: 'text' },
    { key: 'price', label: t('screener.table.columns.price'), type: 'currency' },
    { key: 'market_cap', label: t('screener.table.columns.marketCap'), type: 'currency' },
    { key: 'forward_pe', label: t('screener.table.columns.forwardPe'), type: 'number' },
    { key: 'trailing_pe', label: t('screener.table.columns.trailingPe'), type: 'number' },
    { key: 'peg_ratio', label: t('screener.table.columns.pegRatio'), type: 'number' },
    { key: 'price_to_fcf', label: t('screener.table.columns.priceToFcf'), type: 'number' },
    { key: 'roic', label: t('screener.table.columns.roic'), type: 'percent' },
    { key: 'roe', label: t('screener.table.columns.roe'), type: 'percent' },
    { key: 'revenue_growth', label: t('screener.table.columns.revenueGrowth'), type: 'percent' },
    { key: 'eps_growth', label: t('screener.table.columns.epsGrowth'), type: 'percent' },
    { key: 'free_cash_flow', label: t('screener.table.columns.fcf'), type: 'currency' },
  ];

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
          <Typography variant="h6">{t('screener.compare_drawer.title')}</Typography>
          <Typography variant="body2" color="text.secondary">{t('screener.compare_drawer.selectedCount', { count: stocks.length })}</Typography>
        </Box>
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Box>

      <Box sx={{ p: 2, overflowX: 'auto' }}>
        {stocks.length === 0 ? (
          <Typography color="text.secondary">{t('screener.compare_drawer.empty')}</Typography>
        ) : (
          <Table size="small" sx={{ minWidth: 680 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>{t('screener.compare_drawer.metric')}</TableCell>
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
