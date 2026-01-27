import { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { useTranslation } from 'react-i18next';

import { Add, Refresh } from '@mui/icons-material';
import { HoldingsTable } from '../components/HoldingsTable';
import { ImportWizard } from '../components/ImportWizard';
import { apiClient } from '../../infrastructure/api/client';
import { Transaction } from '../../domain/models/Transaction';
import { Holding } from '../../domain/models/Holding';
import { Portfolio } from '../../domain/models/Portfolio';
import Decimal from 'decimal.js';

/**
 * Dashboard page - main landing page
 */
export function Dashboard() {
  const { t } = useTranslation();
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calculatorId, setCalculatorId] = useState('fifo');

  // New State for API data
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [_transactions, setTransactions] = useState<Transaction[]>([]);

  // Filter state
  const [assetFilter, setAssetFilter] = useState<'ALL' | 'EQUITY' | 'ETF'>(
    'ALL'
  );

  const refreshData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Fetch Portfolio (includes summary and holdings)
      const data = await apiClient.getPortfolio(calculatorId);
      setPortfolio(data);

      // 2. Fetch Transactions (for recent list)
      const txs = await apiClient.getTransactions();
      setTransactions(txs);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to fetch dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, [calculatorId]);

  // Filter logic
  const holdings = portfolio?.holdings || [];
  const filteredHoldings = holdings.filter((h: Holding) => {
    if (assetFilter === 'ALL') return true;
    return h.assetType === assetFilter;
  });

  // Calculate summary metrics based on filtered holdings
  const { totalValue, totalUnrealizedPL, totalRealizedPL, totalCost } =
    useMemo(() => {
      let value = new Decimal(0);
      let unrealized = new Decimal(0);
      let realized = new Decimal(0);

      filteredHoldings.forEach((h: Holding) => {
        value = value.plus(h.marketValue);
        unrealized = unrealized.plus(h.unrealizedPL);
        realized = realized.plus(h.realizedPL);
      });

      const cost = value.minus(unrealized);
      return {
        totalValue: value,
        totalUnrealizedPL: unrealized,
        totalRealizedPL: realized,
        totalCost: cost,
      };
    }, [filteredHoldings]);

  const totalPL = totalUnrealizedPL.plus(totalRealizedPL);

  const totalPLPercent = !totalCost.isZero()
    ? totalPL.div(totalCost).times(100)
    : new Decimal(0);

  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 4 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 3,
          }}
        >
          <Typography variant="h4" component="h1">
            {t('dashboard.title')}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <FormControl sx={{ mr: 2, minWidth: 150 }} size="small">
              <InputLabel id="calculator-select-label">
                {t('dashboard.costBasis')}
              </InputLabel>
              <Select
                labelId="calculator-select-label"
                value={calculatorId}
                label={t('dashboard.costBasis')}
                onChange={e => setCalculatorId(e.target.value)}
              >
                <MenuItem value="fifo">FIFO</MenuItem>
                <MenuItem value="weighted_avg">Weighted Average</MenuItem>
              </Select>
            </FormControl>
            <Button
              startIcon={<Refresh />}
              onClick={refreshData}
              disabled={isLoading}
              sx={{ mr: 2 }}
            >
              {t('dashboard.refresh')}
            </Button>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setImportDialogOpen(true)}
            >
              {t('dashboard.import')}
            </Button>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Filter Tabs - Disabled for MVP if backend doesn't support filtering yet */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={assetFilter} onChange={(_, val) => setAssetFilter(val)}>
            <Tab label={t('dashboard.filterAll')} value="ALL" />
            <Tab label={t('types.equity')} value="EQUITY" />
            <Tab label={t('types.etf')} value="ETF" />
          </Tabs>
        </Box>

        {/* Portfolio Summary Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* Total Value & Cost */}
          <Grid item xs={6} sm={4} md={2}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" variant="caption">
                  {t('dashboard.totalValue')}
                </Typography>
                <Typography variant="h6">${totalValue.toFixed(2)}</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={6} sm={4} md={2}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" variant="caption">
                  {t('dashboard.totalCost')}
                </Typography>
                <Typography variant="h6">${totalCost.toFixed(2)}</Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Realized P/L */}
          <Grid item xs={6} sm={4} md={2}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" variant="caption">
                  {t('dashboard.realizedPL')}
                </Typography>
                <Typography
                  variant="h6"
                  color={totalRealizedPL.gte(0) ? 'success.main' : 'error.main'}
                >
                  ${totalRealizedPL.toFixed(2)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Unrealized P/L */}
          <Grid item xs={6} sm={4} md={2}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" variant="caption">
                  {t('dashboard.unrealizedPL')}
                </Typography>
                <Typography
                  variant="h6"
                  color={
                    totalUnrealizedPL.gte(0) ? 'success.main' : 'error.main'
                  }
                >
                  ${totalUnrealizedPL.toFixed(2)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Total P/L ($) */}
          <Grid item xs={6} sm={4} md={2}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" variant="caption">
                  {t('dashboard.totalPL')}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                  <Typography
                    variant="h6"
                    color={totalPL.gte(0) ? 'success.main' : 'error.main'}
                  >
                    ${totalPL.toFixed(2)}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Total P/L % */}
          <Grid item xs={6} sm={4} md={2}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" variant="caption">
                  {t('dashboard.totalPLPercent')}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                  <Typography
                    variant="h6"
                    color={
                      totalPLPercent.gte(0) ? 'success.main' : 'error.main'
                    }
                  >
                    {totalPLPercent.gte(0) ? '+' : ''}
                    {totalPLPercent.toFixed(2)}%
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Holdings Table */}
        <Typography variant="h5" sx={{ mb: 2 }}>
          {t('dashboard.currentHoldings')}
        </Typography>

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <HoldingsTable
            holdings={filteredHoldings.filter(h => h.quantity.gt(0))}
          />
        )}

        {/* Recent Transactions List (Optional, can keep below) */}
        {/* ... */}
      </Box>

      <ImportWizard
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onImportSuccess={refreshData}
      />
    </Container>
  );
}
