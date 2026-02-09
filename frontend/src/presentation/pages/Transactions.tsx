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
  Select,
  FormControl,
  InputLabel,
  MenuItem,
  Tabs,
  Tab,
  Tooltip,
  Autocomplete,
  TextField,
} from '@mui/material';
import {
  Edit as EditIcon,
  FileDownload as FileDownloadIcon,
  KeyboardArrowDown,
} from '@mui/icons-material';
import { apiClient } from '../../infrastructure/api/client';
import { TransactionType } from '@domain/models/Transaction';
import { useStore } from '@application/store/useStore';
import { TransactionNoteDialog } from '../components/TransactionNoteDialog';
import { useTranslation } from 'react-i18next';

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
  tags?: string[];
  rating?: number;
}

type OrderBy = 'date' | 'symbol' | 'type' | 'quantity' | 'price';

export function Transactions() {
  const { t } = useTranslation();
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [orderBy, setOrderBy] = useState<OrderBy>('date');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [filterSymbol, setFilterSymbol] = useState<string>('');
  const [filterType, setFilterType] = useState<string[]>([]);
  const [tabIndex, setTabIndex] = useState(0);

  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState('');
  const [editingTags, setEditingTags] = useState<string[]>([]);
  const [editingRating, setEditingRating] = useState<number>(0);

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
          tags: t.tags || [],
          rating: t.rating || 0,
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
    if (filterType.length > 0) {
      result = result.filter(t => filterType.includes(t.type));
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

  const handleExportCsv = () => {
    const headers = [
      'Date',
      'Symbol',
      'Type',
      'Quantity',
      'Price',
      'Fees',
      'Total Amount',
      'Realized P/L',
      'Realized Cost Basis',
      'Broker',
      'Notes',
      'Tags',
      'Rating',
    ];

    const csvContent = filteredTransactions.map(tx => {
      return [
        tx.date,
        tx.symbol,
        tx.type,
        tx.quantity,
        tx.price,
        tx.fees,
        tx.total_amount,
        tx.realizedPL !== undefined ? tx.realizedPL.toFixed(2) : '',
        tx.realizedCostBasis !== undefined
          ? tx.realizedCostBasis.toFixed(2)
          : '',
        tx.broker,
        `"${(tx.notes || '').replace(/"/g, '""')}"`,
        `"${(tx.tags || []).join(', ')}"`,
        tx.rating || 0,
      ].join(',');
    });

    const csvString = [headers.join(','), ...csvContent].join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `transactions_export_${new Date().toISOString().split('T')[0]}.csv`
    );
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleEditNote = (
    txId: string,
    currentNote: string,
    currentTags: string[],
    currentRating: number
  ) => {
    setEditingTxId(txId);
    setEditingNote(currentNote || '');
    setEditingTags(currentTags || []);
    setEditingRating(currentRating || 0);
  };

  const handleSaveNote = async (
    note: string,
    tags: string[],
    rating: number
  ) => {
    if (editingTxId) {
      try {
        await apiClient.updateTransactionNotes(editingTxId, note, tags, rating);
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
        {t('transactions.title')}
      </Typography>

      <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)} sx={{ mb: 3 }}>
        <Tab label={t('transactions.allTransactions')} />
      </Tabs>

      {tabIndex === 0 && (
        <>
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <Autocomplete
              value={filterSymbol || null}
              onChange={(_, newValue) => setFilterSymbol(newValue || '')}
              options={uniqueSymbols}
              renderInput={params => (
                <TextField
                  {...params}
                  label={t('transactions.symbol')}
                  variant="outlined"
                />
              )}
              sx={{ minWidth: 200 }}
              size="small"
              popupIcon={<KeyboardArrowDown />}
            />

            <FormControl sx={{ minWidth: 200 }} size="small">
              <InputLabel>{t('transactions.type')}</InputLabel>
              <Select
                multiple
                value={filterType}
                label={t('transactions.type')}
                onChange={e => {
                  const val = e.target.value;
                  setFilterType(
                    typeof val === 'string' ? val.split(',') : (val as string[])
                  );
                }}
                renderValue={selected => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map(value => (
                      <Chip
                        key={value}
                        label={t(`types.${value.toLowerCase()}`)}
                        size="small"
                      />
                    ))}
                  </Box>
                )}
              >
                <MenuItem value={TransactionType.BUY}>
                  {t('types.buy')}
                </MenuItem>
                <MenuItem value={TransactionType.SELL}>
                  {t('types.sell')}
                </MenuItem>
                <MenuItem value={TransactionType.DIVIDEND}>
                  {t('types.dividend')}
                </MenuItem>
                <MenuItem value={TransactionType.FEE}>
                  {t('types.fee')}
                </MenuItem>
                <MenuItem value={TransactionType.TRANSFER}>
                  {t('types.transfer')}
                </MenuItem>
                <MenuItem value={TransactionType.SPLIT}>
                  {t('types.split')}
                </MenuItem>
                <MenuItem value={TransactionType.INTEREST}>
                  {t('types.interest')}
                </MenuItem>
              </Select>
            </FormControl>

            <Tooltip title="Export CSV">
              <IconButton onClick={handleExportCsv} color="primary">
                <FileDownloadIcon />
              </IconButton>
            </Tooltip>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ ml: 'auto', alignSelf: 'center' }}
            >
              {t('transactions.count', {
                count: filteredTransactions.length,
                total: transactions.length,
              })}
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
                        {t('transactions.date')}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={orderBy === 'symbol'}
                        direction={orderBy === 'symbol' ? order : 'asc'}
                        onClick={() => handleSort('symbol')}
                      >
                        {t('transactions.symbol')}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={orderBy === 'type'}
                        direction={orderBy === 'type' ? order : 'asc'}
                        onClick={() => handleSort('type')}
                      >
                        {t('transactions.type')}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right">
                      <TableSortLabel
                        active={orderBy === 'quantity'}
                        direction={orderBy === 'quantity' ? order : 'asc'}
                        onClick={() => handleSort('quantity')}
                      >
                        {t('transactions.quantity')}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right">
                      <TableSortLabel
                        active={orderBy === 'price'}
                        direction={orderBy === 'price' ? order : 'asc'}
                        onClick={() => handleSort('price')}
                      >
                        {t('transactions.price')}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right">
                      {t('transactions.fees')}
                    </TableCell>
                    <TableCell align="right">
                      {t('transactions.total')}
                    </TableCell>
                    <TableCell align="right">
                      {t('transactions.realizedPL')}
                    </TableCell>
                    <TableCell>{t('transactions.broker')}</TableCell>
                    <TableCell>{t('transactions.notes')}</TableCell>
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
                            label={t(`types.${tx.type.toLowerCase()}`, {
                              defaultValue: tx.originalAction || tx.type,
                            })}
                            color={
                              getChipColor(tx.type, tx.originalAction) as any
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
                              {tx.notes || t('transactions.noNotes')}
                            </Typography>
                            <Tooltip title="Edit Note">
                              <IconButton
                                size="small"
                                className="edit-btn"
                                sx={{ opacity: 0, transition: 'opacity 0.2s' }}
                                onClick={() =>
                                  handleEditNote(
                                    tx.id,
                                    tx.notes || '',
                                    tx.tags || [],
                                    tx.rating || 0
                                  )
                                }
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
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
                          {t('transactions.noTransactions')}
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
              labelRowsPerPage={t('common.rowsPerPage')}
            />
          </Paper>
        </>
      )}

      <TransactionNoteDialog
        open={!!editingTxId}
        initialNote={editingNote}
        initialTags={editingTags}
        initialRating={editingRating}
        onClose={() => setEditingTxId(null)}
        onSave={handleSaveNote}
      />
    </Container>
  );
}
