import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import EditIcon from '@mui/icons-material/Edit';
import { TransactionWithPL } from '@domain/models/SymbolTransactionSummary';
import { TransactionType } from '@domain/models/Transaction';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TransactionNoteDialog } from './TransactionNoteDialog';
import { plService } from '@application/services/PLService';

interface SymbolTransactionHistoryProps {
  transactions: TransactionWithPL[];
  isLoading?: boolean;
  onNotesUpdated?: () => void;
}

/**
 * Displays transaction history for a symbol with realized P/L for sells
 */
export function SymbolTransactionHistory({
  transactions,
  isLoading = false,
  onNotesUpdated,
}: SymbolTransactionHistoryProps) {
  const { t } = useTranslation();
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState('');

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

  const handleEditClick = (txId: string, currentNote: string) => {
    setEditingTxId(txId);
    setEditingNote(currentNote || '');
  };

  const handleSaveNote = async (note: string) => {
    if (editingTxId) {
      await plService.updateTransactionNotes(editingTxId, note);
      if (onNotesUpdated) {
        onNotesUpdated();
      }
    }
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
        {t('transactions.emptySymbol')}
      </Typography>
    );
  }

  return (
    <>
      <Table size="small" sx={{ bgcolor: 'action.hover' }}>
        <TableHead>
          <TableRow>
            <TableCell>{t('transactions.date')}</TableCell>
            <TableCell>{t('transactions.type')}</TableCell>
            <TableCell align="right">{t('transactions.quantity')}</TableCell>
            <TableCell align="right">{t('transactions.price')}</TableCell>
            <TableCell align="right">{t('transactions.total')}</TableCell>
            <TableCell align="right">{t('transactions.realizedPL')}</TableCell>
            <TableCell align="right">{t('transactions.returnPct')}</TableCell>
            <TableCell>{t('transactions.notes')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {transactions.map((txWithPL, index) => {
            const tx = txWithPL.transaction;
            const isSell = tx.type === TransactionType.SELL;
            const isBuy = tx.type === TransactionType.BUY;
            const quantity = Math.abs(parseFloat(tx.quantity.toString()));
            const price = parseFloat(tx.price.toString());
            const total = tx.quantity.mul(tx.price).plus(tx.fees).abs();

            return (
              <TableRow key={tx.id || index}>
                <TableCell>{formatDate(tx.date.toISOString())}</TableCell>
                <TableCell>
                  <Chip
                    label={t(`types.${tx.type.toLowerCase()}`)}
                    size="small"
                    color={
                      isBuy
                        ? 'success'
                        : isSell
                          ? 'error'
                          : tx.type === TransactionType.DIVIDEND
                            ? 'info'
                            : 'default'
                    }
                    variant="filled"
                  />
                </TableCell>
                <TableCell align="right">{quantity.toFixed(4)}</TableCell>
                <TableCell align="right">{formatCurrency(price)}</TableCell>
                <TableCell align="right">
                  {formatCurrency(total.toNumber())}
                </TableCell>
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
                <TableCell sx={{ minWidth: 200 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      '&:hover .edit-btn': { opacity: 1 },
                    }}
                  >
                    <Typography
                      variant="body2"
                      color={tx.notes ? 'text.primary' : 'text.secondary'}
                      sx={{
                        maxWidth: 250,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontStyle: tx.notes ? 'normal' : 'italic',
                      }}
                    >
                      {tx.notes || t('transactions.noNotes')}
                    </Typography>
                    <Tooltip title={t('common.edit')}>
                      <IconButton
                        size="small"
                        className="edit-btn"
                        sx={{ opacity: 0, transition: 'opacity 0.2s' }}
                        onClick={() => handleEditClick(tx.id, tx.notes || '')}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <TransactionNoteDialog
        open={!!editingTxId}
        initialNote={editingNote}
        onClose={() => setEditingTxId(null)}
        onSave={handleSaveNote}
      />
    </>
  );
}
