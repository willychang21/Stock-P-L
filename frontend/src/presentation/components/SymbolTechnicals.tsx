import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import LinearProgress from '@mui/material/LinearProgress';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@infrastructure/api/client';
import { Technical } from '@domain/models/Technical';

interface SymbolTechnicalsProps {
  symbol: string;
}

export function SymbolTechnicals({ symbol }: SymbolTechnicalsProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<Technical | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchTechnicals = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await apiClient.getTechnicals([symbol]);
        if (isMounted && response.result && response.result.length > 0) {
          setData(response.result[0]);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to fetch technicals');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchTechnicals();
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

  const formatVolume = (vol?: number) => {
    if (!vol) return '—';
    if (vol >= 1e9) return `${(vol / 1e9).toFixed(2)}B`;
    if (vol >= 1e6) return `${(vol / 1e6).toFixed(2)}M`;
    if (vol >= 1e3) return `${(vol / 1e3).toFixed(2)}K`;
    return formatNumber(vol, 0);
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

  // Determine RSI Color
  let rsiColor = 'text.primary';
  if (data.rsi14) {
    if (data.rsi14 > 70) rsiColor = 'error.main';
    else if (data.rsi14 < 30) rsiColor = 'success.main';
  }

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
        {t('technicals.title', { defaultValue: 'Technical Indicators' })}
      </Typography>

      {/* Warnings Section */}
      {data.warnings && data.warnings.length > 0 && (
        <Stack spacing={1} sx={{ mb: 2 }}>
          {data.warnings.map((warning, idx) => (
            <Alert
              key={idx}
              severity="warning"
              variant="standard"
              icon={false}
              sx={{ py: 0, px: 1 }}
            >
              {warning}
            </Alert>
          ))}
        </Stack>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Box sx={{ mb: 1.5 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
            >
              RSI (14)
            </Typography>
            <Typography variant="body2" fontWeight="bold" color={rsiColor}>
              {formatNumber(data.rsi14)}
            </Typography>
          </Box>
        </Grid>

        <Grid item xs={12} sm={6} md={6}>
          <Box sx={{ mb: 1.5 }}>
            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}
            >
              <Typography variant="caption" color="text.secondary">
                52W Low: ${formatNumber(data.fiftyTwoWeekLow)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                52W High: ${formatNumber(data.fiftyTwoWeekHigh)}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={(data.fiftyTwoWeekPosition || 0) * 100}
              sx={{ height: 8, borderRadius: 4 }}
            />
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              sx={{ mt: 0.5, textAlign: 'center' }}
            >
              Current: ${formatNumber(data.currentPrice)}
            </Typography>
          </Box>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Item label="Volume" value={formatVolume(data.volume)} />
          <Item label="Avg Vol (10D)" value={formatVolume(data.avgVolume10D)} />
          <Item label="Avg Vol (3M)" value={formatVolume(data.avgVolume3M)} />
        </Grid>
      </Grid>
    </Paper>
  );
}
