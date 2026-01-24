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
  Card,
  CardContent,
  Tabs,
  Tab,
  Tooltip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { Edit as EditIcon } from '@mui/icons-material';
import { db } from '@infrastructure/storage/database';
import { TransactionType } from '@domain/models/Transaction';
import { plService } from '../../application/services/PLService';
import { useStore } from '@application/store/useStore';
import Decimal from 'decimal.js';
import { TransactionNoteDialog } from '../components/TransactionNoteDialog';

interface TransactionRow {
  id: string;
  symbol: string;
  transaction_type: string;
  transaction_date: string;
  quantity: string;
  price: string;
  fees: string;
  total_amount: string;
  broker: string;
  raw_data?: string; // Original CSV row data as JSON
  realizedPL?: number; // Calculated P/L for SELL transactions
  realizedCostBasis?: number; // Cost basis for percentage calculation
  originalAction?: string; // Extracted original action from CSV
  notes?: string;
}

interface SymbolSummary {
  symbol: string;
  buyCount: number;
  sellCount: number;
  buyAmount: number;
  sellAmount: number;
  realizedPL: Decimal;
}

type OrderBy =
  | 'transaction_date'
  | 'symbol'
  | 'transaction_type'
  | 'quantity'
  | 'price';

/**
 * Transactions page - displays all stored transactions with analysis
 */
export function Transactions() {
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [orderBy, setOrderBy] = useState<OrderBy>('transaction_date');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [filterSymbol, setFilterSymbol] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [tabIndex, setTabIndex] = useState(0);
  const [symbolSummaries, setSymbolSummaries] = useState<SymbolSummary[]>([]);

  // Note editing state
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState('');

  const costBasisMethod = useStore(state => state.costBasisMethod);
  const lastRefresh = useStore(state => state.lastRefresh);

  // Load transactions
  useEffect(() => {
    loadTransactions();
  }, [lastRefresh]);

  // Calculate symbol summaries when transactions change
  useEffect(() => {
    calculateSymbolSummaries();
  }, [transactions, costBasisMethod]);

  const loadTransactions = async () => {
    try {
      const results = await db.query<TransactionRow>(`
        SELECT id, symbol, transaction_type, transaction_date, 
               quantity, price, fees, total_amount, broker, raw_data, notes
        FROM transactions 
        ORDER BY transaction_date ASC, id ASC
      `);

      // Calculate realized P/L and extract original actions
      const processedTransactions = await processTransactions(results);

      // Reverse to show newest first
      setTransactions(processedTransactions.reverse());
    } catch (error) {
      console.error('Failed to load transactions:', error);
    }
  };

  /**
   * Helper to format raw action codes into readable text
   */
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

  /**
   * Process transactions: calculate P/L and extract original actions
   */
  const processTransactions = async (
    txs: TransactionRow[]
  ): Promise<TransactionRow[]> => {
    // 1. Extract original actions
    for (const tx of txs) {
      if (tx.raw_data) {
        try {
          const data = JSON.parse(tx.raw_data);
          // Schwab
          if (data['Action']) {
            tx.originalAction = data['Action'];
          }
          // Robinhood
          else if (data['Trans Code']) {
            tx.originalAction = formatAction(data['Trans Code']);
          }
        } catch (e) {
          // ignore parsing error
        }
      }
    }

    // 2. Calculate P/L (existing logic)
    // Group transactions by symbol
    const symbolTxs = new Map<string, TransactionRow[]>();

    for (const tx of txs) {
      if (!tx.symbol) continue;
      if (!symbolTxs.has(tx.symbol)) {
        symbolTxs.set(tx.symbol, []);
      }
      symbolTxs.get(tx.symbol)!.push(tx);
    }

    // For each symbol, calculate P/L for sells using FIFO
    for (const [_, symbolTransactions] of symbolTxs.entries()) {
      // Sort by date ASC (already sorted but ensuring)
      symbolTransactions.sort(
        (a, b) =>
          new Date(a.transaction_date).getTime() -
          new Date(b.transaction_date).getTime()
      );

      // FIFO lot queue: { quantity, costBasisPerShare }
      const lots: { quantity: number; costBasis: number }[] = [];

      for (const tx of symbolTransactions) {
        const qty = Math.abs(parseFloat(tx.quantity) || 0);
        const price = parseFloat(tx.price) || 0;

        if (tx.transaction_type === 'BUY' && qty > 0) {
          // Add to lot queue
          lots.push({ quantity: qty, costBasis: price });
        } else if (tx.transaction_type === 'SELL' && qty > 0) {
          // Calculate realized P/L using FIFO
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
              lots.shift(); // Remove depleted lot
            }
          }

          // P/L = Proceeds - Cost Basis
          tx.realizedPL = totalProceeds - totalCostBasis;
          tx.realizedCostBasis = totalCostBasis;
        }
      }
    }

    return txs;
  };

  const calculateSymbolSummaries = async () => {
    // Group transactions by symbol
    const symbolMap = new Map<
      string,
      { buys: TransactionRow[]; sells: TransactionRow[] }
    >();

    for (const tx of transactions) {
      if (!tx.symbol) continue;

      if (!symbolMap.has(tx.symbol)) {
        symbolMap.set(tx.symbol, { buys: [], sells: [] });
      }

      const group = symbolMap.get(tx.symbol)!;
      if (tx.transaction_type === 'BUY') {
        group.buys.push(tx);
      } else if (tx.transaction_type === 'SELL') {
        group.sells.push(tx);
      }
    }

    const summaries: SymbolSummary[] = [];

    // Create an array of promises for parallel execution
    const summaryPromises = Array.from(symbolMap.entries()).map(
      async ([symbol, group]) => {
        if (group.sells.length === 0 && group.buys.length === 0) return null;

        let realizedPL = new Decimal(0);

        // Only calculate P/L if there are sells
        if (group.sells.length > 0) {
          try {
            // Get just this symbol's realized P/L
            const allSymbolPL = await plService.calculateRealizedPL(
              symbol,
              '2000-01-01',
              new Date().toISOString().split('T')[0]!,
              costBasisMethod
            );
            realizedPL = allSymbolPL;
          } catch (err) {
            console.error(`Failed to calculate P/L for ${symbol}:`, err);
          }
        }

        const buyAmount = group.buys.reduce(
          (sum, tx) => sum + Math.abs(parseFloat(tx.total_amount) || 0),
          0
        );
        const sellAmount = group.sells.reduce(
          (sum, tx) => sum + Math.abs(parseFloat(tx.total_amount) || 0),
          0
        );

        return {
          symbol,
          buyCount: group.buys.length,
          sellCount: group.sells.length,
          buyAmount,
          sellAmount,
          realizedPL,
        };
      }
    );

    const results = await Promise.all(summaryPromises);

    // Filter out nulls and push to summaries
    for (const res of results) {
      if (res) summaries.push(res);
    }

    // Sort by symbol
    summaries.sort((a, b) => a.symbol.localeCompare(b.symbol));
    setSymbolSummaries(summaries);
  };

  // Get unique symbols for filter
  const uniqueSymbols = useMemo(() => {
    const transactionsSymbols = transactions.map(t => t.symbol).filter(s => s);
    const symbols = new Set(transactionsSymbols);
    return Array.from(symbols).sort();
  }, [transactions]);

  // Filter and sort transactions
  const filteredTransactions = useMemo(() => {
    let result = [...transactions];

    if (filterSymbol) {
      result = result.filter(t => t.symbol === filterSymbol);
    }
    if (filterType) {
      result = result.filter(t => t.transaction_type === filterType);
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
    try {
      await db.run('DELETE FROM transactions WHERE id = ?', [id]);
      await db.checkpoint();
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
      await plService.updateTransactionNotes(editingTxId, note);
      // Refresh transactions to show new note
      await loadTransactions();
      setEditingTxId(null);
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

  const formatCurrency = (value: number) => {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getChipColor = (type: string, action?: string) => {
    const actionUpper = (action || '').toUpperCase();

    if (actionUpper.includes('REINVEST')) {
      return 'secondary'; // Purple for Reinvestment
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

  // Calculate totals for summary
  const totalRealizedPL = symbolSummaries.reduce(
    (sum, s) => sum.plus(s.realizedPL),
    new Decimal(0)
  );

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
        <Tab label="Trade Analysis" />
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
                        active={orderBy === 'transaction_date'}
                        direction={
                          orderBy === 'transaction_date' ? order : 'asc'
                        }
                        onClick={() => handleSort('transaction_date')}
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
                        active={orderBy === 'transaction_type'}
                        direction={
                          orderBy === 'transaction_type' ? order : 'asc'
                        }
                        onClick={() => handleSort('transaction_type')}
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
                        <TableCell>{formatDate(tx.transaction_date)}</TableCell>
                        <TableCell>
                          <strong>{tx.symbol}</strong>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={tx.originalAction || tx.transaction_type}
                            color={
                              getChipColor(
                                tx.transaction_type,
                                tx.originalAction
                              ) as any
                            }
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
                          {tx.transaction_type === 'SELL' &&
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
                              color={
                                tx.notes ? 'text.primary' : 'text.secondary'
                              }
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

      {tabIndex === 1 && (
        <Box>
          {/* Summary Card */}
          <Card
            sx={{
              mb: 3,
              backgroundColor: totalRealizedPL.gte(0)
                ? 'success.light'
                : 'error.light',
            }}
          >
            <CardContent>
              <Typography variant="h6">Total Realized P/L</Typography>
              <Typography
                variant="h4"
                color={totalRealizedPL.gte(0) ? 'success.dark' : 'error.dark'}
                fontWeight="bold"
              >
                ${totalRealizedPL.toFixed(2)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                From {symbolSummaries.filter(s => s.sellCount > 0).length}{' '}
                symbols with closed positions
              </Typography>
            </CardContent>
          </Card>

          {/* Per-symbol breakdown */}
          <Typography variant="h6" gutterBottom>
            P/L by Symbol
          </Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Symbol</TableCell>
                  <TableCell align="right">Buy Trades</TableCell>
                  <TableCell align="right">Sell Trades</TableCell>
                  <TableCell align="right">Total Bought</TableCell>
                  <TableCell align="right">Total Sold</TableCell>
                  <TableCell align="right">Realized P/L</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {symbolSummaries.map(summary => (
                  <TableRow key={summary.symbol}>
                    <TableCell>
                      <strong>{summary.symbol}</strong>
                    </TableCell>
                    <TableCell align="right">{summary.buyCount}</TableCell>
                    <TableCell align="right">{summary.sellCount}</TableCell>
                    <TableCell align="right">
                      ${formatCurrency(summary.buyAmount)}
                    </TableCell>
                    <TableCell align="right">
                      ${formatCurrency(summary.sellAmount)}
                    </TableCell>
                    <TableCell align="right">
                      {summary.sellCount > 0 ? (
                        <Chip
                          label={`$${summary.realizedPL.toFixed(2)}`}
                          color={
                            summary.realizedPL.gte(0) ? 'success' : 'error'
                          }
                          size="small"
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          —
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {symbolSummaries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ py: 4 }}
                      >
                        No transactions to analyze.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </Container>
  );
}
