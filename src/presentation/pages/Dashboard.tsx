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
import { useStore } from '@application/store/useStore';
import {
  plService,
  PerformanceReport,
} from '../../application/services/PLService';
import Decimal from 'decimal.js';

/**
 * Dashboard page - main landing page
 */
export function Dashboard() {
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [performanceReport, setPerformanceReport] =
    useState<PerformanceReport | null>(null);
  const [assetFilter, setAssetFilter] = useState<'ALL' | 'EQUITY' | 'ETF'>(
    'ALL'
  );

  const holdings = useStore(state => state.holdings);
  const isLoading = useStore(state => state.isLoading);
  const error = useStore(state => state.error);
  const refreshHoldings = useStore(state => state.refreshHoldings);
  const costBasisMethod = useStore(state => state.costBasisMethod);

  // ... (useEffects unchanged) ...
  useEffect(() => {
    refreshHoldings();
  }, [refreshHoldings]);

  // Fetch performance report whenever holdings or cost basis method updates
  useEffect(() => {
    plService
      .getTradePerformance(costBasisMethod)
      .then(setPerformanceReport)
      .catch(console.error);
  }, [holdings, costBasisMethod]);

  // Filter holdings
  const filteredHoldings = Array.from(holdings.values()).filter(h => {
    if (assetFilter === 'ALL') return true;
    return h.assetType === assetFilter;
  });

  // Calculate portfolio summary (with null checks for empty/partial data)
  const totalValue = filteredHoldings.reduce(
    (sum, h) => sum.plus(h.market_value || 0),
    new Decimal(0)
  );

  const totalCost = filteredHoldings.reduce(
    (sum, h) => sum.plus(h.cost_basis || 0),
    new Decimal(0)
  );

  const totalUnrealizedPL = totalValue.minus(totalCost);

  // Get Realized P/L based on filter
  let realizedPL = new Decimal(0);

  if (performanceReport) {
    if (assetFilter === 'ALL')
      realizedPL = performanceReport.overall.totalRealized;
    else if (assetFilter === 'EQUITY')
      realizedPL = performanceReport.byAssetType.EQUITY.totalRealized;
    else if (assetFilter === 'ETF')
      realizedPL = performanceReport.byAssetType.ETF.totalRealized;
  }

  // Calculate Return Percentages
  const unrealizedReturn = totalCost.isZero()
    ? new Decimal(0)
    : totalUnrealizedPL.div(totalCost).times(100);

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
              onClick={() => refreshHoldings()}
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

        {/* Filter Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={assetFilter} onChange={(_, val) => setAssetFilter(val)}>
            <Tab label="All" value="ALL" />
            <Tab label="Equity" value="EQUITY" />
            <Tab label="ETF" value="ETF" />
          </Tabs>
        </Box>

        {/* Portfolio Summary Cards */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
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
          <Grid item xs={6} sm={4} md={2.6}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" variant="caption">
                  Realized P/L
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                  <Typography
                    variant="h6"
                    color={realizedPL.gte(0) ? 'success.main' : 'error.main'}
                  >
                    ${realizedPL.toFixed(2)}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Unrealized P/L */}
          <Grid item xs={6} sm={4} md={2.6}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" variant="caption">
                  Unrealized P/L
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                  <Typography
                    variant="h6"
                    color={
                      totalUnrealizedPL.gte(0) ? 'success.main' : 'error.main'
                    }
                  >
                    ${totalUnrealizedPL.toFixed(2)}
                  </Typography>
                  <Typography
                    variant="body2"
                    color={
                      unrealizedReturn.gte(0) ? 'success.main' : 'error.main'
                    }
                    sx={{ fontWeight: 'bold' }}
                  >
                    ({unrealizedReturn.gte(0) ? '+' : ''}
                    {unrealizedReturn.toFixed(2)}%)
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Total P/L */}
          <Grid item xs={6} sm={4} md={2.6}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" variant="caption">
                  Total P/L
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                  <Typography
                    variant="h6"
                    color={
                      realizedPL.plus(totalUnrealizedPL).gte(0)
                        ? 'success.main'
                        : 'error.main'
                    }
                    fontWeight="bold"
                  >
                    ${realizedPL.plus(totalUnrealizedPL).toFixed(2)}
                  </Typography>
                  <Typography
                    variant="body2"
                    color={
                      realizedPL.plus(totalUnrealizedPL).gte(0)
                        ? 'success.main'
                        : 'error.main'
                    }
                    sx={{ fontWeight: 'bold' }}
                  >
                    ({realizedPL.plus(totalUnrealizedPL).gte(0) ? '+' : ''}
                    {totalCost.isZero()
                      ? '0.00'
                      : realizedPL
                          .plus(totalUnrealizedPL)
                          .div(totalCost)
                          .times(100)
                          .toFixed(2)}
                    %)
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
      </Box>

      <ImportWizard
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
      />
    </Container>
  );
}
