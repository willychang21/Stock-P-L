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

interface TimePeriodTableProps {
  data: PeriodStats[];
}

export const TimePeriodTable: React.FC<TimePeriodTableProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ p: 2 }}>
        No data available
      </Typography>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Period</TableCell>
            <TableCell align="right">Realized P/L</TableCell>
            <TableCell align="right">Trades</TableCell>
            <TableCell align="right">Wins</TableCell>
            <TableCell align="right">Losses</TableCell>
            <TableCell align="right">Win Rate</TableCell>
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
