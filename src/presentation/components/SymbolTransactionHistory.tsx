import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  Chip,
  Box,
  CircularProgress,
} from '@mui/material';
import { TransactionWithPL } from '@domain/models/SymbolTransactionSummary';
import { TransactionType } from '@domain/models/Transaction';

interface SymbolTransactionHistoryProps {
  transactions: TransactionWithPL[];
  isLoading?: boolean;
}

/**
 * Displays transaction history for a symbol with realized P/L for sells
 */
export function SymbolTransactionHistory({
  transactions,
  isLoading = false,
}: SymbolTransactionHistoryProps) {
  const formatCurrency = (value: number | string): string => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return `$${num.toFixed(2)}`;
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatPct = (value: number): string => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (transactions.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2, pl: 2 }}>
        No transactions found.
      </Typography>
    );
  }

  return (
    <Table size="small" sx={{ bgcolor: 'action.hover' }}>
      <TableHead>
        <TableRow>
          <TableCell>Date</TableCell>
          <TableCell>Type</TableCell>
          <TableCell align="right">Quantity</TableCell>
          <TableCell align="right">Price</TableCell>
          <TableCell align="right">Total</TableCell>
          <TableCell align="right">Realized P/L</TableCell>
          <TableCell align="right">Return %</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {transactions.map((txWithPL, index) => {
          const tx = txWithPL.transaction;
          const isSell = tx.transaction_type === TransactionType.SELL;
          const isBuy = tx.transaction_type === TransactionType.BUY;
          const quantity = Math.abs(parseFloat(tx.quantity.toString()));
          const price = parseFloat(tx.price.toString());
          const total = Math.abs(parseFloat(tx.total_amount.toString()));

          return (
            <TableRow key={tx.id || index}>
              <TableCell>{formatDate(tx.transaction_date)}</TableCell>
              <TableCell>
                <Chip
                  label={tx.transaction_type}
                  size="small"
                  color={
                    isBuy
                      ? 'success'
                      : isSell
                        ? 'error'
                        : tx.transaction_type === TransactionType.DIVIDEND
                          ? 'info'
                          : 'default'
                  }
                  variant="filled"
                />
              </TableCell>
              <TableCell align="right">{quantity.toFixed(4)}</TableCell>
              <TableCell align="right">{formatCurrency(price)}</TableCell>
              <TableCell align="right">{formatCurrency(total)}</TableCell>
              <TableCell align="right">
                {txWithPL.realized_pl !== null ? (
                  <Chip
                    label={formatCurrency(
                      parseFloat(txWithPL.realized_pl.toString())
                    )}
                    size="small"
                    color={txWithPL.realized_pl.gte(0) ? 'success' : 'error'}
                  />
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    —
                  </Typography>
                )}
              </TableCell>
              <TableCell align="right">
                {txWithPL.return_percentage !== null ? (
                  <Box
                    sx={{
                      color: txWithPL.return_percentage.gte(0)
                        ? 'success.main'
                        : 'error.main',
                      fontWeight: 'bold',
                    }}
                  >
                    {formatPct(
                      parseFloat(txWithPL.return_percentage.toString())
                    )}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    —
                  </Typography>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
