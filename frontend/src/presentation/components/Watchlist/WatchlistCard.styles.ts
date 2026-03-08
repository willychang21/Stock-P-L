import { alpha, Theme } from '@mui/material/styles';
import { SxProps } from '@mui/material';
import { WatchlistDisplayState } from './utils';

export const getCardStyles = (
  theme: Theme,
  displayState: WatchlistDisplayState,
  hasAlerts: boolean
): SxProps<Theme> => {
  const borderColor =
    displayState === 'READY'
      ? theme.palette.success.main
      : hasAlerts
        ? theme.palette.error.main
        : theme.palette.common.white;

  const borderOpacity = displayState === 'READY' || hasAlerts ? 0.24 : 0.08;

  return {
    height: '100%',
    border: `1px solid ${alpha(borderColor, borderOpacity)}`,
    background: `linear-gradient(180deg, ${alpha(
      theme.palette.background.paper,
      0.98
    )} 0%, ${alpha(theme.palette.common.black, 0.92)} 100%)`, // Replaced hardcoded #07111f with common.black
    boxShadow: `0 28px 70px ${alpha(theme.palette.common.black, 0.14)}`,
    opacity: displayState === 'RESEARCH_ONLY' ? 0.88 : 1,
  };
};

export const getMetricsPaperStyles = (theme: Theme): SxProps<Theme> => ({
  p: 1.5,
  borderRadius: 2,
  border: `1px solid ${alpha(theme.palette.common.white, 0.08)}`,
  background: alpha(theme.palette.common.black, 0.2),
});

export const getAlertPaperStyles = (theme: Theme): SxProps<Theme> => ({
  p: 1.5,
  borderRadius: 2,
  bgcolor: alpha(theme.palette.error.main, 0.05),
  border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
});

export const getFactorChipStyles = (): SxProps<Theme> => ({
  px: 1.5,
  py: 1,
  borderRadius: 2,
  bgcolor: 'rgba(0, 0, 0, 0.2)',
  border: '1px solid rgba(255, 255, 255, 0.05)',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  height: '100%',
});
