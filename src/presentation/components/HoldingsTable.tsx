import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TableSortLabel,
  Typography,
  Chip,
  Box,
  Collapse,
  IconButton,
} from '@mui/material';
import { KeyboardArrowDown, KeyboardArrowUp } from '@mui/icons-material';
import { useState, useEffect, Fragment } from 'react';
import Decimal from 'decimal.js';
import { Holding } from '@domain/models/Holding';
import { SymbolTransactionHistory } from './SymbolTransactionHistory';
import { plService } from '@application/services/PLService';
import { TransactionWithPL } from '@domain/models/SymbolTransactionSummary';
import { useStore } from '@application/store/useStore';

type SortField =
  | 'symbol'
  | 'shares'
  | 'avgCost'
  | 'currentPrice'
  | 'marketValue'
  | 'unrealizedPL'
  | 'returnPct';
type SortOrder = 'asc' | 'desc';

interface HoldingsTableProps {
  holdings: Holding[];
  onSymbolClick?: (symbol: string) => void;
}

/**
 * A single row with expandable transaction history
 */
function HoldingRow({
  holding,
  formatCurrency,
  formatShares,
  formatPct,
}: {
  holding: Holding;
  formatCurrency: (value: Decimal) => string;
  formatShares: (value: Decimal) => string;
  formatPct: (value: Decimal) => string;
}) {
  const [open, setOpen] = useState(false);
  const [transactions, setTransactions] = useState<TransactionWithPL[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const costBasisMethod = useStore(state => state.costBasisMethod);

  const returnPct = holding.costBasis.isZero()
    ? new Decimal(0)
    : holding.unrealizedPL.div(holding.costBasis).times(100);
  const isPositive = returnPct.gte(0);

  // Load transactions when row is expanded
  const fetchTransactions = () => {
    setIsLoading(true);
    plService
      .getTransactionsWithPL(holding.symbol, costBasisMethod)
      .then(summary => {
        setTransactions(summary.transactions);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (open && transactions.length === 0) {
      fetchTransactions();
    }
  }, [open, holding.symbol, costBasisMethod]);

  return (
    <Fragment>
      <TableRow
        hover
        onClick={() => setOpen(!open)}
        sx={{ cursor: 'pointer', '& > *': { borderBottom: 'unset' } }}
      >
        <TableCell>
          <IconButton
            size="small"
            onClick={e => {
              e.stopPropagation();
              setOpen(!open);
            }}
          >
            {open ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Typography variant="body1" fontWeight="bold">
            {holding.symbol}
          </Typography>
        </TableCell>
        <TableCell>
          <Chip
            label={holding.assetType}
            size="small"
            variant="filled"
            color={holding.assetType === 'ETF' ? 'primary' : 'default'}
          />
        </TableCell>
        <TableCell align="right">
          {formatShares(holding.quantity)}
        </TableCell>
        <TableCell align="right">
          {formatCurrency(holding.averageCost)}
        </TableCell>
        <TableCell align="right">
          {holding.currentPrice.gt(0)
            ? formatCurrency(holding.currentPrice)
            : '—'}
        </TableCell>
        <TableCell align="right">
          {formatCurrency(holding.marketValue)}
        </TableCell>
        <TableCell align="right">
          <Chip
            label={formatCurrency(holding.unrealizedPL)}
            color={holding.unrealizedPL.gte(0) ? 'success' : 'error'}
            size="small"
          />
        </TableCell>
        <TableCell align="right">
          <Box
            sx={{
              color: isPositive ? 'success.main' : 'error.main',
              fontWeight: 'bold',
            }}
          >
            {formatPct(returnPct)}
          </Box>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={9}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 1 }}>
              <Typography variant="subtitle2" gutterBottom component="div">
                Transaction History
              </Typography>
              <SymbolTransactionHistory
                transactions={transactions}
                isLoading={isLoading}
                onNotesUpdated={fetchTransactions}
              />
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </Fragment>
  );
}

/**
 * Holdings table component with sorting, return % display, and expandable transaction history
 */
export function HoldingsTable({ holdings }: HoldingsTableProps) {
  const [sortField, setSortField] = useState<SortField>('symbol');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Calculate return % for a holding
  const getReturnPct = (holding: Holding): Decimal => {
    if (holding.costBasis.isZero()) return new Decimal(0);
    return holding.unrealizedPL.div(holding.costBasis).times(100);
  };

  // Filter out holdings with zero shares (with null check)
  const activeHoldings = holdings.filter(
    h => h.quantity && !h.quantity.isZero()
  );

  const sortedHoldings = [...activeHoldings].sort((a, b) => {
    let aVal: string | Decimal;
    let bVal: string | Decimal;

    switch (sortField) {
      case 'symbol':
        return sortOrder === 'asc'
          ? a.symbol.localeCompare(b.symbol)
          : b.symbol.localeCompare(a.symbol);
      case 'shares':
        aVal = a.quantity;
        bVal = b.quantity;
        break;
      case 'avgCost':
        aVal = a.averageCost;
        bVal = b.averageCost;
        break;
      case 'currentPrice':
        aVal = a.currentPrice;
        bVal = b.currentPrice;
        break;
      case 'marketValue':
        aVal = a.marketValue;
        bVal = b.marketValue;
        break;
      case 'unrealizedPL':
        aVal = a.unrealizedPL;
        bVal = b.unrealizedPL;
        break;
      case 'returnPct':
        aVal = getReturnPct(a);
        bVal = getReturnPct(b);
        break;
      default:
        return 0;
    }

    const comparison = aVal.comparedTo(bVal);
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const formatCurrency = (value: Decimal): string => {
    return `$${value.toFixed(2)}`;
  };

  const formatShares = (value: Decimal): string => {
    return value.toFixed(4);
  };

  const formatPct = (value: Decimal): string => {
    const sign = value.gte(0) ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  if (activeHoldings.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">
          No current holdings. Import transactions to get started.
        </Typography>
      </Paper>
    );
  }

  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 50 }} />
            <TableCell>
              <TableSortLabel
                active={sortField === 'symbol'}
                direction={sortField === 'symbol' ? sortOrder : 'asc'}
                onClick={() => handleSort('symbol')}
              >
                Symbol
              </TableSortLabel>
            </TableCell>
            <TableCell>Type</TableCell>
            <TableCell align="right">
              <TableSortLabel
                active={sortField === 'shares'}
                direction={sortField === 'shares' ? sortOrder : 'asc'}
                onClick={() => handleSort('shares')}
              >
                Shares
              </TableSortLabel>
            </TableCell>
            <TableCell align="right">
              <TableSortLabel
                active={sortField === 'avgCost'}
                direction={sortField === 'avgCost' ? sortOrder : 'asc'}
                onClick={() => handleSort('avgCost')}
              >
                Avg Cost
              </TableSortLabel>
            </TableCell>
            <TableCell align="right">
              <TableSortLabel
                active={sortField === 'currentPrice'}
                direction={sortField === 'currentPrice' ? sortOrder : 'asc'}
                onClick={() => handleSort('currentPrice')}
              >
                Current Price
              </TableSortLabel>
            </TableCell>
            <TableCell align="right">
              <TableSortLabel
                active={sortField === 'marketValue'}
                direction={sortField === 'marketValue' ? sortOrder : 'asc'}
                onClick={() => handleSort('marketValue')}
              >
                Market Value
              </TableSortLabel>
            </TableCell>
            <TableCell align="right">
              <TableSortLabel
                active={sortField === 'unrealizedPL'}
                direction={sortField === 'unrealizedPL' ? sortOrder : 'asc'}
                onClick={() => handleSort('unrealizedPL')}
              >
                Unrealized P/L
              </TableSortLabel>
            </TableCell>
            <TableCell align="right">
              <TableSortLabel
                active={sortField === 'returnPct'}
                direction={sortField === 'returnPct' ? sortOrder : 'asc'}
                onClick={() => handleSort('returnPct')}
              >
                Return %
              </TableSortLabel>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedHoldings.map(holding => (
            <HoldingRow
              key={holding.symbol}
              holding={holding}
              formatCurrency={formatCurrency}
              formatShares={formatShares}
              formatPct={formatPct}
            />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
