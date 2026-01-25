import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  CircularProgress,
  Chip,
  Grid,
  Alert,
  Autocomplete,
} from '@mui/material';
import {
  KeyboardArrowDown,
  TrendingUp,
  TrendingDown,
  RemoveCircleOutline,
} from '@mui/icons-material';

// Simple inline interface for the Strategy Response
interface StrategyResponse {
  symbol: string;
  price: number;
  indicators: {
    rsi: number;
    sma20: number;
    sma50: number;
    sma200: number;
  };
  analysis: {
    signal:
      | 'OVERSOLD'
      | 'OVERBOUGHT'
      | 'PULLBACK'
      | 'UPTREND'
      | 'DOWNTREND'
      | 'HOLD';
    action: 'BUY' | 'SELL' | 'WAIT' | 'ADD' | 'TRIM';
    reason: string;
  };
}

// Assuming we can fetch directly or via a new service. I'll use fetch for simplicity.
const fetchSignals = async (symbol: string): Promise<StrategyResponse> => {
  const res = await fetch(
    `http://localhost:3001/api/strategy/signals/${symbol}`
  );
  if (!res.ok) throw new Error('Failed to fetch signals');
  return res.json();
};

export function TechnicalSignals() {
  const [symbol, setSymbol] = useState<string | null>(null);
  const [data, setData] = useState<StrategyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reuse symbol list from store if available or just let user type
  // For MVP, user types or we fetch list. Let's use a hardcoded list or fetch unique from transactions if possible.
  // Actually, let's just let user type for now to keep it independent, or try to get from props if needed.
  // Better yet, use the same list as Transactions page if possible.
  // I will make it a free text Autocomplete for now powered by a simple list or just text input.
  const [options, setOptions] = useState<string[]>([]);

  useEffect(() => {
    // Fetch unique symbols from backend for autocomplete
    fetch('http://localhost:3001/api/transactions') // Reusing transactions endpoint to get existing symbols
      .then(res => res.json())
      .then((txs: any[]) => {
        const syms = Array.from(
          new Set(txs.map(t => t.symbol).filter(Boolean))
        ).sort();
        setOptions(syms as string[]);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (symbol) {
      setLoading(true);
      setError(null);
      fetchSignals(symbol)
        .then(setData)
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [symbol]);

  const getActionColor = (action: string) => {
    switch (action) {
      case 'BUY':
      case 'ADD':
        return 'success';
      case 'SELL':
      case 'TRIM':
        return 'error';
      case 'WAIT':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getRsiColor = (rsi: number) => {
    if (rsi < 30) return 'success.main';
    if (rsi > 70) return 'error.main';
    return 'text.primary';
  };

  return (
    <Card
      sx={{
        height: '100%',
        background: 'rgba(24, 24, 27, 0.6)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      <CardContent>
        <Typography variant="h6" fontWeight="bold" gutterBottom>
          Technical Signals
        </Typography>

        <Box sx={{ mb: 3 }}>
          <Autocomplete
            value={symbol}
            onChange={(_, newValue) => setSymbol(newValue)}
            options={options}
            freeSolo // Allow typing new symbols
            renderInput={params => (
              <TextField
                {...params}
                label="Search Symbol (e.g. AAPL)"
                variant="outlined"
                size="small"
                fullWidth
              />
            )}
            popupIcon={<KeyboardArrowDown />}
          />
        </Box>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {data && !loading && (
          <Grid container spacing={2}>
            {/* Price & Signal */}
            <Grid item xs={12}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 1,
                }}
              >
                <Box>
                  <Typography variant="h4" fontWeight="bold">
                    ${data.price.toFixed(2)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Current Price
                  </Typography>
                </Box>
                <Chip
                  label={data.analysis.action}
                  color={getActionColor(data.analysis.action) as any}
                  sx={{ fontWeight: 'bold', px: 1 }}
                />
              </Box>
              <Alert
                severity={getActionColor(data.analysis.action) as any}
                icon={
                  data.analysis.action === 'BUY' ||
                  data.analysis.action === 'ADD' ? (
                    <TrendingUp />
                  ) : data.analysis.action === 'WAIT' ? (
                    <RemoveCircleOutline />
                  ) : (
                    <TrendingDown />
                  )
                }
                sx={{ mb: 2 }}
              >
                {data.analysis.reason}
              </Alert>
            </Grid>

            {/* Indicators */}
            <Grid item xs={6}>
              <Box
                sx={{
                  p: 1.5,
                  bgcolor: 'rgba(255,255,255,0.03)',
                  borderRadius: 2,
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  RSI (14)
                </Typography>
                <Typography
                  variant="h6"
                  fontWeight="bold"
                  sx={{ color: getRsiColor(data.indicators.rsi) }}
                >
                  {data.indicators.rsi}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ display: 'block', mt: 0.5, opacity: 0.7 }}
                >
                  {data.indicators.rsi < 30
                    ? 'OVERSOLD'
                    : data.indicators.rsi > 70
                      ? 'OVERBOUGHT'
                      : 'NEUTRAL'}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box
                sx={{
                  p: 1.5,
                  bgcolor: 'rgba(255,255,255,0.03)',
                  borderRadius: 2,
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  Trend (200 SMA)
                </Typography>
                <Typography variant="h6" fontWeight="bold">
                  ${data.indicators.sma200}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color:
                      data.price > data.indicators.sma200
                        ? 'success.main'
                        : 'error.main',
                  }}
                >
                  {data.price > data.indicators.sma200
                    ? 'ABOVE (Bullish)'
                    : 'BELOW (Bearish)'}
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={12}>
              <Box
                sx={{
                  p: 1.5,
                  bgcolor: 'rgba(255,255,255,0.03)',
                  borderRadius: 2,
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  Short Term (20 SMA)
                </Typography>
                <Typography variant="body1" fontWeight="bold">
                  ${data.indicators.sma20}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Medium Term (50 SMA)
                </Typography>
                <Typography variant="body1" fontWeight="bold">
                  ${data.indicators.sma50}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        )}
      </CardContent>
    </Card>
  );
}
