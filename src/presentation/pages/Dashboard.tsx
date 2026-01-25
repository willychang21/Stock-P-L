import { useEffect, useState } from 'react';
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
} from '@mui/material';

import { Add, Refresh } from '@mui/icons-material';
import { HoldingsTable } from '../components/HoldingsTable';
import { ImportWizard } from '../components/ImportWizard';
import { apiClient } from '../../infrastructure/api/client';
import { plService } from '../../application/services/PLService';
import { PortfolioSummary } from '../../domain/models/PortfolioSummary';
import { Transaction } from '../../domain/models/Transaction';
import { Holding } from '../../domain/models/Holding';
import Decimal from 'decimal.js';

/**
 * Dashboard page - main landing page
 */
export function Dashboard() {
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New State for API data
  const [portfolioSummary, setPortfolioSummary] =
    useState<PortfolioSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);

  // Filter state (Note: Filtering might need to move to backend or happen on fetched data)
  const [assetFilter, setAssetFilter] = useState<'ALL' | 'EQUITY' | 'ETF'>(
    'ALL'
  );

  const refreshData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Fetch Summary
      const summary = await apiClient.getPortfolioSummary();
      setPortfolioSummary(summary);

      // 2. Fetch Transactions (for recent list)
      const txs = await apiClient.getTransactions();
      setTransactions(txs);

      // 3. Calculate Holdings (Client-side for now)
      const holdingsMap = await plService.getAllHoldings();

      // 4. Fetch Current Prices (Fix for missing price in Holdings Table)
      const symbols = Array.from(holdingsMap.keys());
      if (symbols.length > 0) {
        const quoteResponse = await apiClient.getQuotes(symbols);
        const quotes = quoteResponse.result || [];

        // Merge prices into holdings
        for (const quote of quotes) {
          const sym = quote.symbol;
          if (holdingsMap.has(sym)) {
            const holding = holdingsMap.get(sym)!;
            const price = new Decimal(quote.regularMarketPrice || 0);

            // Update holding with price
            // We need to mutate or replace the holding in the map
            const normalizedType = quote.quoteType === 'ETF' ? 'ETF' : 'EQUITY';

            const updatedHolding = {
              ...holding,
              current_price: price,
              assetType: normalizedType,
              market_value: holding.total_shares.times(price),
              unrealized_pl: holding.total_shares
                .times(price)
                .minus(holding.cost_basis),
            };
            holdingsMap.set(sym, updatedHolding);
          }
        }
      }

      setHoldings(Array.from(holdingsMap.values()));
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to fetch dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Filter logic
  const filteredHoldings = holdings.filter(h => {
    if (assetFilter === 'ALL') return true;
    return h.assetType === assetFilter;
  });

  const totalValue = portfolioSummary
    ? new Decimal(portfolioSummary.total_value || 0)
    : new Decimal(0);
  const totalCost = portfolioSummary
    ? new Decimal(portfolioSummary.total_cost || 0)
    : new Decimal(0);
  const totalPL = portfolioSummary
    ? new Decimal(portfolioSummary.total_pl || 0)
    : new Decimal(0);
  const totalPLPercent = portfolioSummary
    ? new Decimal(portfolioSummary.total_pl_percent || 0)
    : new Decimal(0);
  const totalRealizedPL = portfolioSummary
    ? new Decimal(portfolioSummary.total_realized_pl || 0)
    : new Decimal(0);
  const totalUnrealizedPL = portfolioSummary
    ? new Decimal(portfolioSummary.total_unrealized_pl || 0)
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
            Portfolio Dashboard
          </Typography>
          <Box>
            <Button
              startIcon={<Refresh />}
              onClick={refreshData}
              disabled={isLoading}
              sx={{ mr: 2 }}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setImportDialogOpen(true)}
            >
              Import CSV
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
            <Tab label="All" value="ALL" />
            <Tab label="Equity" value="EQUITY" />
            <Tab label="ETF" value="ETF" />
          </Tabs>
        </Box>

        {/* Portfolio Summary Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* Total Value & Cost */}
          <Grid item xs={6} sm={4} md={2}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" variant="caption">
                  Total Value
                </Typography>
                <Typography variant="h6">${totalValue.toFixed(2)}</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={6} sm={4} md={2}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" variant="caption">
                  Total Cost
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
                  Realized P/L
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
                  Unrealized P/L
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
                  Total P/L ($)
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
                  Total P/L (%)
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
          Current Holdings
        </Typography>

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <HoldingsTable holdings={filteredHoldings} />
        )}

        {/* Recent Transactions List (Optional, can keep below) */}
        {/* ... */}
      </Box>

      <ImportWizard
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
      />
    </Container>
  );
}
