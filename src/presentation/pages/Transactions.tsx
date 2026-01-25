import { useState, useEffect, useMemo } from 'react';
import {
  Container,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  TablePagination,
  TableSortLabel,
  IconButton,
  Alert,
  Select,
  FormControl,
  InputLabel,
  MenuItem,
  Tabs,
  Tab,
  Tooltip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { Edit as EditIcon } from '@mui/icons-material';
import { apiClient } from '../../infrastructure/api/client';
import { TransactionType } from '@domain/models/Transaction';
import { useStore } from '@application/store/useStore';
import { TransactionNoteDialog } from '../components/TransactionNoteDialog';

interface TransactionRow {
  id: string;
  symbol: string;
  type: TransactionType;
  date: string;
  quantity: string;
  price: string;
  fees: string;
  total_amount: string;
  broker: string;
  rawData?: string;
  realizedPL?: number;
  realizedCostBasis?: number;
  originalAction?: string;
  notes?: string;
}

type OrderBy =
  | 'date'
  | 'symbol'
  | 'type'
  | 'quantity'
  | 'price';

export function Transactions() {
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [orderBy, setOrderBy] = useState<OrderBy>('date');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [filterSymbol, setFilterSymbol] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [tabIndex, setTabIndex] = useState(0);

  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState('');

  const lastRefresh = useStore(state => state.lastRefresh);

  useEffect(() => {
    loadTransactions();
  }, [lastRefresh]);

  const loadTransactions = async () => {
    try {
      const txs = await apiClient.getTransactions();

      const rows: TransactionRow[] = txs.map(t => {
        const isValidDate = t.date instanceof Date && !isNaN(t.date.getTime());
        return {
          id: t.id,
          symbol: t.symbol,
          type: t.type,
          date: isValidDate ? t.date.toISOString() : new Date().toISOString(),
          quantity: t.quantity.toString(),
          price: t.price.toString(),
          fees: t.fees.toString(),
          total_amount: t.quantity.mul(t.price).plus(t.fees).toString(),
          broker: t.broker || '',
          rawData: t.rawData,
          notes: t.notes,
        };
      });

      const processedTransactions = await processTransactions(rows);
      setTransactions(processedTransactions.reverse());
    } catch (error) {
      console.error('Failed to load transactions:', error);
    }
  };

  const formatAction = (action: string): string => {
    const map: Record<string, string> = {
      CDIV: 'Cash Dividend',
      INT: 'Interest',
      ACH: 'Deposit',
      RTP: 'Bank Transfer',
      GOLD: 'Gold Fee',
    };
    return map[action] || action;
  };

  const processTransactions = async (
    txs: TransactionRow[]
  ): Promise<TransactionRow[]> => {
    for (const tx of txs) {
      if (tx.rawData) {
        try {
          const data = JSON.parse(tx.rawData);
          if (data['Action']) {
            tx.originalAction = data['Action'];
          } else if (data['Trans Code']) {
            tx.originalAction = formatAction(data['Trans Code']);
          }
        } catch (e) {}
      }
    }

    const symbolTxs = new Map<string, TransactionRow[]>();

    for (const tx of txs) {
      if (!tx.symbol) continue;
      if (!symbolTxs.has(tx.symbol)) {
        symbolTxs.set(tx.symbol, []);
      }
      symbolTxs.get(tx.symbol)!.push(tx);
    }

    for (const [_, symbolTransactions] of symbolTxs.entries()) {
      symbolTransactions.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      const lots: { quantity: number; costBasis: number }[] = [];

      for (const tx of symbolTransactions) {
        const qty = Math.abs(parseFloat(tx.quantity) || 0);
        const price = parseFloat(tx.price) || 0;

        if (tx.type === TransactionType.BUY && qty > 0) {
          lots.push({ quantity: qty, costBasis: price });
        } else if (tx.type === TransactionType.SELL && qty > 0) {
          let remainingToSell = qty;
          let totalCostBasis = 0;
          let totalProceeds = qty * price;

          while (remainingToSell > 0 && lots.length > 0) {
            const lot = lots[0]!;
            const sellFromLot = Math.min(remainingToSell, lot.quantity);

            totalCostBasis += sellFromLot * lot.costBasis;
            lot.quantity -= sellFromLot;
            remainingToSell -= sellFromLot;

            if (lot.quantity <= 0.0001) {
              lots.shift();
            }
          }

          tx.realizedPL = totalProceeds - totalCostBasis;
          tx.realizedCostBasis = totalCostBasis;
        }
      }
    }

    return txs;
  };

  const uniqueSymbols = useMemo(() => {
    const transactionsSymbols = transactions.map(t => t.symbol).filter(s => s);
    const symbols = new Set(transactionsSymbols);
    return Array.from(symbols).sort();
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    let result = [...transactions];

    if (filterSymbol) {
      result = result.filter(t => t.symbol === filterSymbol);
    }
    if (filterType) {
      result = result.filter(t => t.type === filterType);
    }

    result.sort((a, b) => {
      let aVal: string | number = a[orderBy] as string;
      let bVal: string | number = b[orderBy] as string;

      if (orderBy === 'quantity' || orderBy === 'price') {
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
      }

      if (order === 'asc') {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });

    return result;
  }, [transactions, filterSymbol, filterType, orderBy, order]);

  const handleSort = (property: OrderBy) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) return;
    try {
      await apiClient.deleteTransaction(id);
      loadTransactions();
    } catch (error) {
      setDeleteError('Failed to delete transaction');
      setTimeout(() => setDeleteError(null), 3000);
    }
  };

  const handleEditNote = (txId: string, currentNote: string) => {
    setEditingTxId(txId);
    setEditingNote(currentNote || '');
  };

  const handleSaveNote = async (note: string) => {
    if (editingTxId) {
      try {
        await apiClient.updateTransactionNotes(editingTxId, note);
        await loadTransactions();
        setEditingTxId(null);
      } catch (error) {
        console.error('Failed to update note:', error);
        alert('Failed to update note');
      }
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return dateStr;
    }
  };

  const formatNumber = (value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    return num.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  };

  const getChipColor = (type: string, action?: string) => {
    const actionUpper = (action || '').toUpperCase();

    if (actionUpper.includes('REINVEST')) {
      return 'secondary';
    }

    switch (type) {
      case TransactionType.BUY:
        return 'success';
      case TransactionType.SELL:
        return 'error';
      case TransactionType.DIVIDEND:
        return 'info';
      case TransactionType.FEE:
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <Container maxWidth="xl">
      <Typography variant="h4" component="h1" gutterBottom>
        Transactions
      </Typography>

      {deleteError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {deleteError}
        </Alert>
      )}

      <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)} sx={{ mb: 3 }}>
        <Tab label="All Transactions" />
      </Tabs>

      {tabIndex === 0 && (
        <>
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <FormControl sx={{ minWidth: 150 }}>
              <InputLabel>Symbol</InputLabel>
              <Select
                value={filterSymbol}
                label="Symbol"
                onChange={e => setFilterSymbol(e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                {uniqueSymbols.map(symbol => (
                  <MenuItem key={symbol} value={symbol}>
                    {symbol}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl sx={{ minWidth: 150 }}>
              <InputLabel>Type</InputLabel>
              <Select
                value={filterType}
                label="Type"
                onChange={e => setFilterType(e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value={TransactionType.BUY}>Buy</MenuItem>
                <MenuItem value={TransactionType.SELL}>Sell</MenuItem>
                <MenuItem value={TransactionType.DIVIDEND}>Dividend</MenuItem>
                <MenuItem value={TransactionType.FEE}>Fee</MenuItem>
              </Select>
            </FormControl>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ ml: 'auto', alignSelf: 'center' }}
            >
              {filteredTransactions.length} of {transactions.length}{' '}
              transactions
            </Typography>
          </Box>

          <Paper>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>
                      <TableSortLabel
                        active={orderBy === 'date'}
                        direction={orderBy === 'date' ? order : 'asc'}
                        onClick={() => handleSort('date')}
                      >
                        Date
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={orderBy === 'symbol'}
                        direction={orderBy === 'symbol' ? order : 'asc'}
                        onClick={() => handleSort('symbol')}
                      >
                        Symbol
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={orderBy === 'type'}
                        direction={orderBy === 'type' ? order : 'asc'}
                        onClick={() => handleSort('type')}
                      >
                        Type
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right">
                      <TableSortLabel
                        active={orderBy === 'quantity'}
                        direction={orderBy === 'quantity' ? order : 'asc'}
                        onClick={() => handleSort('quantity')}
                      >
                        Quantity
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right">
                      <TableSortLabel
                        active={orderBy === 'price'}
                        direction={orderBy === 'price' ? order : 'asc'}
                        onClick={() => handleSort('price')}
                      >
                        Price
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right">Fees</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell align="right">Realized P/L</TableCell>
                    <TableCell>Broker</TableCell>
                    <TableCell>Notes</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredTransactions
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map(tx => (
                      <TableRow key={tx.id} hover>
                        <TableCell>{formatDate(tx.date)}</TableCell>
                        <TableCell>
                          <strong>{tx.symbol}</strong>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={tx.originalAction || tx.type}
                            color={getChipColor(tx.type, tx.originalAction) as any}
                            size="small"
                            variant="filled"
                          />
                        </TableCell>
                        <TableCell align="right">
                          {formatNumber(tx.quantity)}
                        </TableCell>
                        <TableCell align="right">
                          ${formatNumber(tx.price)}
                        </TableCell>
                        <TableCell align="right">
                          ${formatNumber(tx.fees)}
                        </TableCell>
                        <TableCell align="right">
                          ${formatNumber(tx.total_amount)}
                        </TableCell>
                        <TableCell align="right">
                          {tx.type === TransactionType.SELL &&
                          tx.realizedPL !== undefined &&
                          tx.realizedPL !== 0 ? (
                            <Box
                              sx={{
                                display: 'flex',
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                gap: 1,
                              }}
                            >
                              <Chip
                                label={`${tx.realizedPL >= 0 ? '+' : ''}$${tx.realizedPL.toFixed(2)}`}
                                color={tx.realizedPL >= 0 ? 'success' : 'error'}
                                size="small"
                              />
                              <Typography
                                variant="caption"
                                fontWeight="bold"
                                color={
                                  tx.realizedPL >= 0
                                    ? 'success.main'
                                    : 'error.main'
                                }
                              >
                                ({tx.realizedPL >= 0 ? '+' : ''}
                                {tx.realizedCostBasis &&
                                tx.realizedCostBasis > 0
                                  ? (
                                      (tx.realizedPL / tx.realizedCostBasis) *
                                      100
                                    ).toFixed(2)
                                  : '0.00'}
                                %)
                              </Typography>
                            </Box>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              —
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>{tx.broker}</TableCell>
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
                              {tx.notes || 'No notes'}
                            </Typography>
                            <Tooltip title="Edit Note">
                              <IconButton
                                size="small"
                                className="edit-btn"
                                sx={{ opacity: 0, transition: 'opacity 0.2s' }}
                                onClick={() =>
                                  handleEditNote(tx.id, tx.notes || '')
                                }
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDelete(tx.id)}
                            title="Delete transaction"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  {filteredTransactions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={11} align="center">
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ py: 4 }}
                        >
                          No transactions found. Import a CSV file to get
                          started.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              rowsPerPageOptions={[10, 25, 50, 100]}
              component="div"
              count={filteredTransactions.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              onRowsPerPageChange={e => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
            />
          </Paper>
        </>
      )}

      <TransactionNoteDialog
        open={!!editingTxId}
        initialNote={editingNote}
        onClose={() => setEditingTxId(null)}
        onSave={handleSaveNote}
      />
    </Container>
  );
}