import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@infrastructure/api/client';
import { Fundamental } from '@domain/models/Fundamental';

interface SymbolFundamentalsProps {
  symbol: string;
}

export function SymbolFundamentals({ symbol }: SymbolFundamentalsProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<Fundamental | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchFundamentals = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await apiClient.getFundamentals([symbol]);
        if (isMounted && response.result && response.result.length > 0) {
          setData(response.result[0]);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to fetch fundamentals');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchFundamentals();
    return () => {
      isMounted = false;
    };
  }, [symbol]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="warning">{error}</Alert>
      </Box>
    );
  }

  if (!data) {
    return null;
  }

  const formatNumber = (num?: number, decimals: number = 2) => {
    if (num === undefined || num === null) return '—';
    return Number(num).toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  const formatPct = (num?: number) => {
    if (num === undefined || num === null) return '—';
    return `${(num * 100).toFixed(2)}%`;
  };

  const formatDate = (timestamp?: number | null) => {
    if (!timestamp) return '—';
    // Yahoo finance timestamps are usually in seconds
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString();
  };

  const formatMarketCap = (marketCap?: number) => {
    if (!marketCap) return '—';
    if (marketCap >= 1e12) return `$${(marketCap / 1e12).toFixed(2)}T`;
    if (marketCap >= 1e9) return `$${(marketCap / 1e9).toFixed(2)}B`;
    if (marketCap >= 1e6) return `$${(marketCap / 1e6).toFixed(2)}M`;
    return `$${formatNumber(marketCap, 0)}`;
  };

  const Item = ({
    label,
    value,
  }: {
    label: string;
    value: React.ReactNode;
  }) => (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight="medium">
        {value}
      </Typography>
    </Box>
  );

  return (
    <Paper
      variant="outlined"
      sx={{ p: 2, mb: 2, bgcolor: 'background.default' }}
    >
      <Typography
        variant="subtitle2"
        gutterBottom
        sx={{ mb: 2, fontWeight: 'bold' }}
      >
        {t('fundamentals.title', { defaultValue: 'Fundamental Details' })}
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Item label="Sector" value={data.sector || '—'} />
          <Item label="Industry" value={data.industry || '—'} />
          <Item label="Market Cap" value={formatMarketCap(data.marketCap)} />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Item label="P/E Ratio (TTM)" value={formatNumber(data.trailingPE)} />
          <Item label="Forward P/E" value={formatNumber(data.forwardPE)} />
          <Item
            label="EPS (TTM)"
            value={
              data.trailingEps ? `$${formatNumber(data.trailingEps)}` : '—'
            }
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Item label="Profit Margin" value={formatPct(data.profitMargins)} />
          <Item label="ROE" value={formatPct(data.returnOnEquity)} />
          <Item label="Revenue Growth" value={formatPct(data.revenueGrowth)} />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Item label="Dividend Yield" value={formatPct(data.dividendYield)} />
          <Item
            label="Ex-Dividend Date"
            value={formatDate(data.exDividendDate)}
          />
          <Item label="Beta" value={formatNumber(data.beta)} />
        </Grid>
      </Grid>
    </Paper>
  );
}
