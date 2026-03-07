import React, { memo } from 'react';
import { Box, Tooltip, Typography } from '@mui/material';

interface ValuationScoreCellProps {
  score?: number | null;
  label?: string | null;
  lowConfidence?: boolean | null;
}

const getColors = (score: number) => {
  if (score >= 80)
    return {
      bg: 'rgba(52, 211, 153, 0.15)',
      border: '#34d399',
      text: '#34d399',
    }; // green
  if (score >= 60)
    return {
      bg: 'rgba(99, 179, 237, 0.15)',
      border: '#63b3ed',
      text: '#63b3ed',
    }; // blue
  if (score >= 40)
    return {
      bg: 'rgba(251, 191, 36, 0.15)',
      border: '#fbbf24',
      text: '#fbbf24',
    }; // yellow
  return {
    bg: 'rgba(248, 113, 113, 0.15)',
    border: '#f87171',
    text: '#f87171',
  }; // red
};

export const ValuationScoreCell: React.FC<ValuationScoreCellProps> = memo(
  ({ score, label, lowConfidence }) => {
    if (score === undefined || score === null) {
      return (
        <Typography
          variant="caption"
          color="text.disabled"
          sx={{ fontVariantNumeric: 'tabular-nums' }}
        >
          —
        </Typography>
      );
    }

    const colors = getColors(score);
    const displayScore = `${lowConfidence ? '~' : ''}${Math.round(score)}`;
    const tooltipTitle = `${label ?? ''}${lowConfidence ? ' (limited peers — lower confidence)' : ''}`;

    return (
      <Tooltip title={tooltipTitle} arrow placement="left">
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 44,
            height: 24,
            borderRadius: '12px',
            bgcolor: colors.bg,
            border: `1px solid ${colors.border}`,
            cursor: 'default',
            transition: 'opacity 0.2s ease',
            '&:hover': { opacity: 0.8 },
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: colors.text,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
            }}
          >
            {displayScore}
          </Typography>
        </Box>
      </Tooltip>
    );
  }
);

ValuationScoreCell.displayName = 'ValuationScoreCell';
export default ValuationScoreCell;
