import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
} from '@mui/material';
import { PeriodStats } from '@application/services/PLService';
import { useTranslation } from 'react-i18next';

interface TimePeriodTableProps {
  data: PeriodStats[];
}

export const TimePeriodTable: React.FC<TimePeriodTableProps> = ({ data }) => {
  const { t } = useTranslation();

  if (data.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ p: 2 }}>
        {t('analysis.table.noData')}
      </Typography>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('analysis.table.period')}</TableCell>
            <TableCell align="right">
              {t('analysis.table.realizedPL')}
            </TableCell>
            <TableCell align="right">{t('analysis.table.trades')}</TableCell>
            <TableCell align="right">{t('analysis.table.wins')}</TableCell>
            <TableCell align="right">{t('analysis.table.losses')}</TableCell>
            <TableCell align="right">{t('analysis.table.winRate')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map(row => (
            <TableRow key={row.period}>
              <TableCell component="th" scope="row">
                {row.period}
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  color: row.realizedPL.gte(0) ? 'success.main' : 'error.main',
                  fontWeight: 'medium',
                }}
              >
                ${row.realizedPL.toFixed(2)}
              </TableCell>
              <TableCell align="right">{row.tradeCount}</TableCell>
              <TableCell align="right" sx={{ color: 'success.main' }}>
                {row.winCount}
              </TableCell>
              <TableCell align="right" sx={{ color: 'error.main' }}>
                {row.lossCount}
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  color: row.winRate >= 50 ? 'success.main' : 'error.main',
                }}
              >
                {row.winRate.toFixed(1)}%
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
