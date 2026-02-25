import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Skeleton from '@mui/material/Skeleton';
import Chip from '@mui/material/Chip';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@infrastructure/api/client';
import { MarketSentiment } from '@domain/models/MarketSentiment';

export function MarketSentimentWidget() {
  const theme = useTheme();
  const { t } = useTranslation();
  const [data, setData] = useState<MarketSentiment | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchSentiment = async () => {
      try {
        const response = await apiClient.getMarketSentiment();
        if (isMounted && response.result) {
          setData(response.result);
        }
      } catch (err) {
        console.error('Failed to fetch sentiment:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchSentiment();
    return () => {
      isMounted = false;
    };
  }, []);

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'RISING':
        return <TrendingUpIcon fontSize="small" sx={{ ml: 0.5 }} />;
      case 'FALLING':
        return <TrendingDownIcon fontSize="small" sx={{ ml: 0.5 }} />;
      default:
        return <TrendingFlatIcon fontSize="small" sx={{ ml: 0.5 }} />;
    }
  };

  const getRegimeColor = (regime: string) => {
    switch (regime) {
      case 'HIGH_FEAR':
        return 'error';
      case 'RISK_OFF':
        return 'warning';
      case 'COMPLACENCY':
        return 'success';
      default:
        return 'info';
    }
  };

  // Modern Glassmorphism Card Style
  const glassCardStyle = {
    background:
      theme.palette.mode === 'dark'
        ? 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)'
        : 'linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.4) 100%)',
    backdropFilter: 'blur(12px)',
    border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
    boxShadow:
      theme.palette.mode === 'dark'
        ? '0 8px 32px 0 rgba(0, 0, 0, 0.3)'
        : '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
    borderRadius: '16px',
    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
    overflow: 'hidden',
    position: 'relative' as const,
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow:
        theme.palette.mode === 'dark'
          ? '0 12px 40px 0 rgba(0, 0, 0, 0.4)'
          : '0 12px 40px 0 rgba(31, 38, 135, 0.1)',
    },
  };

  // Subtle gradient border effect using a pseudo-element
  const gradientGlow = {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '2px',
    background:
      'linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.5), transparent)',
    opacity: 0.5,
  };

  if (isLoading) {
    return (
      <Card sx={glassCardStyle}>
        <Box sx={{ '&::before': gradientGlow }} />
        <CardContent sx={{ py: 3, '&:last-child': { pb: 3 } }}>
          <Grid container spacing={3} alignItems="center">
            <Grid
              item
              xs={12}
              sm={4}
              md={3}
              sx={{ borderRight: { sm: 1 }, borderColor: 'divider' }}
            >
              <Skeleton variant="text" width="60%" height={24} />
              <Skeleton
                variant="rectangular"
                width="80%"
                height={32}
                sx={{ mt: 1, borderRadius: 1 }}
              />
            </Grid>
            <Grid
              item
              xs={12}
              sm={4}
              md={3}
              sx={{ borderRight: { md: 1 }, borderColor: 'divider' }}
            >
              <Skeleton variant="text" width="80%" height={24} />
              <Skeleton variant="text" width="50%" height={40} />
            </Grid>
            <Grid item xs={12} sm={4} md={6}>
              <Skeleton variant="text" width="40%" height={24} />
              <Box sx={{ display: 'flex', gap: 3, mt: 1 }}>
                <Box>
                  <Skeleton variant="text" width={80} height={20} />
                  <Skeleton variant="text" width={60} height={30} />
                </Box>
                <Box>
                  <Skeleton variant="text" width={80} height={20} />
                  <Skeleton variant="text" width={60} height={30} />
                </Box>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card sx={glassCardStyle}>
      <Box sx={{ '&::before': gradientGlow }} />
      <CardContent sx={{ py: 3, '&:last-child': { pb: 3 } }}>
        <Grid container spacing={4} alignItems="center">
          {/* Regime */}
          <Grid
            item
            xs={12}
            sm={4}
            md={3}
            sx={{ borderRight: { sm: `1px solid ${theme.palette.divider}` } }}
          >
            <Typography
              variant="overline"
              sx={{ letterSpacing: 1.5, opacity: 0.7, fontWeight: 600 }}
              display="block"
            >
              {t('dashboard.sentiment.marketRegime')}
            </Typography>
            <Chip
              label={t(`dashboard.sentiment.regime.${data.marketRegime}`)}
              color={getRegimeColor(data.marketRegime) as any}
              sx={{
                mt: 0.5,
                fontWeight: 700,
                px: 1,
                boxShadow: `0 4px 12px ${theme.palette[getRegimeColor(data.marketRegime) as 'success' | 'error' | 'warning' | 'info']?.main}40`,
                transition: 'all 0.2s',
                '&:hover': {
                  transform: 'scale(1.05)',
                },
              }}
            />
          </Grid>

          {/* VIX */}
          <Grid
            item
            xs={12}
            sm={4}
            md={3}
            sx={{ borderRight: { md: `1px solid ${theme.palette.divider}` } }}
          >
            <Typography
              variant="overline"
              sx={{ letterSpacing: 1.5, opacity: 0.7, fontWeight: 600 }}
              display="block"
            >
              {t('dashboard.sentiment.vix')}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'flex-end', mt: 0.5 }}>
              <Typography
                variant="h4"
                component="span"
                sx={{
                  fontWeight: 800,
                  lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                  background:
                    theme.palette.mode === 'dark'
                      ? 'linear-gradient(to right, #fff, #aaa)'
                      : 'none',
                  WebkitBackgroundClip:
                    theme.palette.mode === 'dark' ? 'text' : 'unset',
                  WebkitTextFillColor:
                    theme.palette.mode === 'dark' ? 'transparent' : 'unset',
                }}
              >
                {data.vix.value.toFixed(2)}
              </Typography>
              <Typography
                variant="body2"
                color={
                  data.vix.trend === 'RISING'
                    ? 'error.main'
                    : data.vix.trend === 'FALLING'
                      ? 'success.main'
                      : 'text.secondary'
                }
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  ml: 1,
                  mb: 0.5,
                  fontWeight: 600,
                }}
              >
                ({t(`dashboard.sentiment.trend.${data.vix.trend}`)})
                {getTrendIcon(data.vix.trend)}
              </Typography>
            </Box>
          </Grid>

          {/* Safe Havens */}
          <Grid item xs={12} sm={4} md={6}>
            <Typography
              variant="overline"
              sx={{ letterSpacing: 1.5, opacity: 0.7, fontWeight: 600 }}
              display="block"
            >
              {t('dashboard.sentiment.safeHavenFlows')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 5, alignItems: 'center', mt: 1 }}>
              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    opacity: 0.6,
                    fontWeight: 500,
                    textTransform: 'uppercase',
                  }}
                >
                  {t('dashboard.sentiment.goldFutures')}
                </Typography>
                <Typography
                  variant="subtitle1"
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    fontWeight: 700,
                  }}
                  color={
                    data.safeHavens.goldTrend === 'RISING'
                      ? 'warning.main'
                      : 'text.secondary'
                  }
                >
                  {t(`dashboard.sentiment.trend.${data.safeHavens.goldTrend}`)}{' '}
                  {getTrendIcon(data.safeHavens.goldTrend)}
                </Typography>
              </Box>
              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    opacity: 0.6,
                    fontWeight: 500,
                    textTransform: 'uppercase',
                  }}
                >
                  {t('dashboard.sentiment.treasuryYield10Y')}
                </Typography>
                <Typography
                  variant="subtitle1"
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    fontWeight: 700,
                  }}
                  color={
                    data.safeHavens.treasuryYieldTrend === 'RISING'
                      ? 'error.main'
                      : 'success.main'
                  }
                >
                  {t(
                    `dashboard.sentiment.trend.${data.safeHavens.treasuryYieldTrend}`
                  )}{' '}
                  {getTrendIcon(data.safeHavens.treasuryYieldTrend)}
                </Typography>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}
