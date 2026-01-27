import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Grid,
  InputAdornment,
  Divider,
  Button,
} from '@mui/material';
import { RestartAlt } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

export function PositionSizeCalculator() {
  const [accountSize, setAccountSize] = useState<string>('10000');
  const [riskPercent, setRiskPercent] = useState<string>('1');
  const [entryPrice, setEntryPrice] = useState<string>('');
  const [stopLoss, setStopLoss] = useState<string>('');

  // Outputs
  const [shares, setShares] = useState<number>(0);
  const [positionValue, setPositionValue] = useState<number>(0);
  const [riskAmount, setRiskAmount] = useState<number>(0);
  const [riskPerShare, setRiskPerShare] = useState<number>(0);
  const { t } = useTranslation();

  useEffect(() => {
    calculate();
  }, [accountSize, riskPercent, entryPrice, stopLoss]);

  const calculate = () => {
    const acc = parseFloat(accountSize) || 0;
    const risk = parseFloat(riskPercent) || 0;
    const entry = parseFloat(entryPrice) || 0;
    const stop = parseFloat(stopLoss) || 0;

    if (acc > 0 && risk > 0 && entry > 0 && stop > 0 && entry !== stop) {
      const riskAmt = acc * (risk / 100);
      const riskPerSh = Math.abs(entry - stop);
      const shareCount = Math.floor(riskAmt / riskPerSh);
      const posValue = shareCount * entry;

      setRiskAmount(riskAmt);
      setRiskPerShare(riskPerSh);
      setShares(shareCount);
      setPositionValue(posValue);
    } else {
      setShares(0);
      setPositionValue(0);
      setRiskAmount(0);
      setRiskPerShare(0);
    }
  };

  const clear = () => {
    setEntryPrice('');
    setStopLoss('');
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" fontWeight="bold">
            {t('tools.calculator.title')}
          </Typography>
          <Button startIcon={<RestartAlt />} size="small" onClick={clear}>
            {t('tools.calculator.reset')}
          </Button>
        </Box>

        <Grid container spacing={3}>
          {/* Inputs */}
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label={t('tools.calculator.accountSize')}
                type="number"
                value={accountSize}
                onChange={e => setAccountSize(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">$</InputAdornment>
                  ),
                }}
                fullWidth
                size="small"
              />
              <TextField
                label={t('tools.calculator.maxRisk')}
                type="number"
                value={riskPercent}
                onChange={e => setRiskPercent(e.target.value)}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">%</InputAdornment>
                  ),
                }}
                fullWidth
                size="small"
              />
              <Divider sx={{ my: 1 }} />
              <TextField
                label={t('tools.calculator.entryPrice')}
                type="number"
                value={entryPrice}
                onChange={e => setEntryPrice(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">$</InputAdornment>
                  ),
                }}
                fullWidth
                size="small"
                autoFocus
              />
              <TextField
                label={t('tools.calculator.stopLoss')}
                type="number"
                value={stopLoss}
                onChange={e => setStopLoss(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">$</InputAdornment>
                  ),
                }}
                error={
                  parseFloat(stopLoss) > 0 &&
                  parseFloat(entryPrice) > 0 &&
                  parseFloat(stopLoss) >= parseFloat(entryPrice)
                    ? false // Allow short selling scenario? Let's assume long for now, but math works for both.
                    : false
                }
                fullWidth
                size="small"
              />
            </Box>
          </Grid>

          {/* Results */}
          <Grid item xs={12} md={6}>
            <Box
              sx={{
                p: 2,
                bgcolor: 'rgba(255,255,255,0.03)',
                borderRadius: 2,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: 2,
              }}
            >
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {t('tools.calculator.recommendedSize')}
                </Typography>
                <Typography variant="h3" color="primary.main" fontWeight="bold">
                  {shares}{' '}
                  <span style={{ fontSize: '1rem' }}>
                    {t('tools.calculator.shares')}
                  </span>
                </Typography>
              </Box>

              <Divider />

              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  {t('tools.calculator.totalValue')}
                </Typography>
                <Typography variant="body1" fontWeight="bold">
                  ${positionValue.toLocaleString()}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  {t('tools.calculator.capitalAtRisk')}
                </Typography>
                <Typography
                  variant="body1"
                  fontWeight="bold"
                  color="error.main"
                >
                  ${riskAmount.toFixed(2)}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  {t('tools.calculator.riskPerShare')}
                </Typography>
                <Typography variant="body1">
                  ${riskPerShare.toFixed(2)}
                </Typography>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}
