import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Fade,
  Grid,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Calculate as CalculateIcon,
  DeleteOutline as DeleteOutlineIcon,
  Insights as InsightsIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { WatchlistService } from '../../application/services/WatchlistService';
import {
  WatchPlanType,
  WatchSignalAction,
  WatchlistItem,
  WatchlistSearchItem,
} from '../../domain/models/Watchlist';
import StockInsightDrawer from '../components/Screener/StockInsightDrawer';
import { DCFValuationTool } from '../components/tools/DCFValuationTool';
import { Dialog, DialogContent, Paper } from '@mui/material';
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatRange,
  formatSignedPercent,
} from '../utils/formatters';

const WatchlistPage: React.FC = () => {
  const signalColor = (
    signal: WatchSignalAction
  ): 'success' | 'warning' | 'error' => {
    if (signal === 'BUY') return 'success';
    if (signal === 'SELL') return 'error';
    return 'warning';
  };

  const planColor = (
    planType: WatchPlanType
  ): 'success' | 'info' | 'warning' | 'error' => {
    if (planType === 'LONG') return 'success';
    if (planType === 'WAIT') return 'info';
    if (planType === 'AVOID') return 'warning';
    return 'info';
  };

  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchOptions, setSearchOptions] = useState<WatchlistSearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [selectedOption, setSelectedOption] = useState<WatchlistSearchItem | null>(
    null
  );
  const [adding, setAdding] = useState(false);
  const [filterText, setFilterText] = useState('');

  const [insightOpen, setInsightOpen] = useState(false);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightSymbol, setInsightSymbol] = useState('');
  const [insightData, setInsightData] = useState<any | null>(null);

  const [dcfOpen, setDcfOpen] = useState(false);
  const [dcfSymbol, setDcfSymbol] = useState('');
  const [dcfInitialData, setDcfInitialData] = useState<any | null>(null);

  const loadWatchlist = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await WatchlistService.fetchWatchlist();
      setWatchlist(response.items || []);
    } catch (loadError: any) {
      setError(loadError?.message || 'Failed to load watchlist');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWatchlist();
  }, [loadWatchlist]);

  useEffect(() => {
    const q = inputValue.trim();
    if (q.length < 1) {
      setSearchOptions([]);
      return;
    }

    let isCancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const options = await WatchlistService.searchSymbols(q, 12);
        if (!isCancelled) {
          setSearchOptions(options);
        }
      } catch {
        if (!isCancelled) {
          setSearchOptions([]);
        }
      } finally {
        if (!isCancelled) {
          setSearching(false);
        }
      }
    }, 250);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [inputValue]);

  const handleAdd = async () => {
    const rawSymbol = selectedOption?.symbol || inputValue;
    const symbol = rawSymbol.trim().toUpperCase();
    if (!symbol) return;

    setAdding(true);
    setError(null);
    try {
      await WatchlistService.addSymbol(symbol);
      await loadWatchlist();
      setInputValue('');
      setSelectedOption(null);
      setSearchOptions([]);
    } catch (addError: any) {
      setError(addError?.message || `Failed to add ${symbol}`);
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (symbol: string) => {
    try {
      await WatchlistService.removeSymbol(symbol);
      setWatchlist(prev => prev.filter(item => item.symbol !== symbol));
    } catch (removeError: any) {
      setError(removeError?.message || `Failed to remove ${symbol}`);
    }
  };

  const handleOpenDCF = (item: WatchlistItem) => {
    setDcfSymbol(item.symbol);
    setDcfInitialData(item);
    setDcfOpen(true);
  };

  const openInsights = async (symbol: string) => {
    setInsightSymbol(symbol);
    setInsightOpen(true);
    setInsightLoading(true);
    try {
      const data = await WatchlistService.getSymbolInsights(symbol);
      setInsightData(data);
    } catch {
      setInsightData(null);
    } finally {
      setInsightLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return watchlist;
    return watchlist.filter(item => {
      const symbol = item.symbol.toLowerCase();
      const name = (item.name || '').toLowerCase();
      const sector = (item.sector || '').toLowerCase();
      return symbol.includes(q) || name.includes(q) || sector.includes(q);
    });
  }, [watchlist, filterText]);

  const stats = useMemo(() => {
    const init = { total: filteredItems.length, buy: 0, hold: 0, sell: 0 };
    return filteredItems.reduce((acc, item) => {
      const action = item.signal?.action;
      if (action === 'BUY') acc.buy += 1;
      if (action === 'HOLD') acc.hold += 1;
      if (action === 'SELL') acc.sell += 1;
      return acc;
    }, init);
  }, [filteredItems]);

  const getGfScoreColor = (score?: number) => {
    if (score === undefined || score === null) return 'default';
    if (score >= 75) return 'success';
    if (score >= 55) return 'warning';
    return 'error';
  };

  try {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Fade in timeout={650}>
        <Box>
          <Box
            sx={{
              mb: 3,
              p: { xs: 2, md: 3 },
              borderRadius: 3,
              border: '1px solid rgba(16,185,129,0.28)',
              background:
                'radial-gradient(circle at 12% 18%, rgba(16,185,129,0.25) 0%, rgba(12,15,30,0.9) 40%, rgba(8,10,20,0.96) 100%)',
            }}
          >
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              alignItems={{ xs: 'flex-start', md: 'center' }}
              justifyContent="space-between"
            >
              <Box>
                <Typography
                  variant="h3"
                  sx={{ fontWeight: 800, letterSpacing: '-0.02em', mb: 0.5 }}
                >
                  Watchlist Radar
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Add tickers in seconds, then rank ideas by signal quality before acting.
                </Typography>
              </Box>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={loadWatchlist}
                disabled={loading}
                sx={{ borderColor: 'rgba(52,211,153,0.5)' }}
              >
                Refresh Signals
              </Button>
            </Stack>

            <Stack
              direction={{ xs: 'column', lg: 'row' }}
              spacing={1.25}
              sx={{ mt: 2.5 }}
            >
              <Autocomplete<WatchlistSearchItem, false, false, true>
                freeSolo
                options={searchOptions}
                value={selectedOption}
                inputValue={inputValue}
                loading={searching}
                filterOptions={x => x}
                getOptionLabel={option =>
                  typeof option === 'string'
                    ? option
                    : `${option.symbol}${option.name ? ` • ${option.name}` : ''}`
                }
                onInputChange={(_, value) => {
                  setInputValue(value);
                }}
                onChange={(_, value) => {
                  if (typeof value === 'string') {
                    setSelectedOption({ symbol: value.toUpperCase() });
                    return;
                  }
                  setSelectedOption(value);
                }}
                renderOption={(props, option) => (
                  <Box component="li" {...props}>
                    <Stack direction="row" spacing={1.2} alignItems="center">
                      <Typography sx={{ fontWeight: 700, minWidth: 72 }}>
                        {option.symbol}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {option.name || 'No name'}
                      </Typography>
                    </Stack>
                  </Box>
                )}
                renderInput={params => (
                  <TextField
                    {...params}
                    placeholder="Search ticker or company name"
                    sx={{ minWidth: { xs: '100%', lg: 480 } }}
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  />
                )}
              />

              <Button
                variant="contained"
                startIcon={<AddIcon />}
                disabled={adding || (!selectedOption && !inputValue.trim())}
                onClick={handleAdd}
              >
                {adding ? 'Adding...' : 'Add to Watchlist'}
              </Button>

              <TextField
                size="small"
                placeholder="Filter existing watchlist"
                value={filterText}
                onChange={event => setFilterText(event.target.value)}
                sx={{ minWidth: { xs: '100%', lg: 260 } }}
              />
            </Stack>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Grid container spacing={1.5} sx={{ mb: 2 }}>
            <Grid item xs={6} md={3}>
              <Card>
                <CardContent sx={{ py: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    Symbols
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {stats.total}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} md={3}>
              <Card>
                <CardContent sx={{ py: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    BUY Bias
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>
                    {stats.buy}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} md={3}>
              <Card>
                <CardContent sx={{ py: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    HOLD Bias
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: 'warning.main' }}>
                    {stats.hold}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} md={3}>
              <Card>
                <CardContent sx={{ py: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    SELL Risk
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: 'error.main' }}>
                    {stats.sell}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Alert severity="info" sx={{ mb: 2 }}>
            Signals combine valuation, growth, quality, and yfinance technical momentum. Use as a decision aid, not financial advice.
          </Alert>

          {loading ? (
            <Box sx={{ py: 10, textAlign: 'center' }}>
              <CircularProgress />
            </Box>
          ) : filteredItems.length === 0 ? (
            <Card sx={{ border: '1px solid rgba(255,255,255,0.08)' }}>
              <CardContent sx={{ py: 8, textAlign: 'center' }}>
                <Typography variant="h6" gutterBottom>
                  Watchlist is empty
                </Typography>
                <Typography color="text.secondary">
                  Search a ticker and add it to start monitoring live buy/sell signals.
                </Typography>
              </CardContent>
            </Card>
          ) : (
            <Grid container spacing={1.5}>
              {filteredItems.map(item => (
                <Grid key={item.symbol} item xs={12} md={6} xl={4}>
                  <Card sx={{ height: '100%', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <CardContent>
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="flex-start"
                        spacing={1}
                      >
                        <Box>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                            <Typography variant="h5" sx={{ fontWeight: 800 }}>
                              {item.symbol}
                            </Typography>
                            <Chip
                              size="small"
                              label={item.signal.action}
                              color={signalColor(item.signal.action)}
                              sx={{ height: 22, fontWeight: 'bold' }}
                            />
                            <Chip
                              size="small"
                              label={item.trade_plan.plan_type}
                              color={planColor(item.trade_plan.plan_type)}
                              variant="outlined"
                              sx={{ height: 22, fontWeight: 'bold' }}
                            />
                          </Stack>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                            {item.name || 'Name unavailable'}
                          </Typography>
                          
                          <Stack direction="row" alignItems="baseline" spacing={1.5}>
                            <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                              {formatCurrency(item.price)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                              Mkt Cap: {formatCurrency(item.market_cap)}
                            </Typography>
                          </Stack>
                        </Box>
                        <Tooltip title="Remove from watchlist">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleRemove(item.symbol)}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>

                      {/* Key Metrics Strip */}
                      <Paper variant="outlined" sx={{ mt: 2.5, p: 1.5, bgcolor: 'background.default', borderRadius: 2 }}>
                        <Grid container spacing={2}>
                          <Grid item xs={3}>
                            <Typography variant="caption" color="text.secondary">Fwd P/E</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{formatNumber(item.forward_pe, 1)}</Typography>
                          </Grid>
                          <Grid item xs={3}>
                            <Typography variant="caption" color="text.secondary">ROIC</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{formatPercent(item.roic, 1)}</Typography>
                          </Grid>
                          <Grid item xs={3}>
                            <Typography variant="caption" color="text.secondary">Rev Growth</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 'bold', color: (item.revenue_growth || 0) >= 0 ? 'success.main' : 'error.main' }}>
                              {formatSignedPercent(item.revenue_growth, 1)}
                            </Typography>
                          </Grid>
                          <Grid item xs={3}>
                            <Typography variant="caption" color="text.secondary">EPS Growth</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 'bold', color: (item.eps_growth || 0) >= 0 ? 'success.main' : 'error.main' }}>
                              {formatSignedPercent(item.eps_growth, 1)}
                            </Typography>
                          </Grid>
                        </Grid>
                      </Paper>

                      {/* Valuation Summary Box */}
                      <Box
                        sx={{
                          mt: 2,
                          p: 2,
                          borderRadius: 2,
                          border: '1px solid',
                          borderColor: (item.valuation.upside_pct || 0) >= 0 ? 'success.light' : 'error.light',
                          bgcolor: (item.valuation.upside_pct || 0) >= 0 ? 'rgba(16, 185, 129, 0.04)' : 'rgba(239, 68, 68, 0.04)',
                        }}
                      >
                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                            Valuation Estimate
                          </Typography>
                          <Tooltip title="Optimize DCF Valuation">
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => handleOpenDCF(item)}
                              startIcon={<CalculateIcon fontSize="small" />}
                              sx={{ 
                                textTransform: 'none', 
                                borderRadius: 6, 
                                py: 0.2, 
                                borderColor: 'divider',
                                color: 'text.secondary',
                                '&:hover': { bgcolor: 'primary.50', color: 'primary.main', borderColor: 'primary.main' }
                              }}
                            >
                              Model
                            </Button>
                          </Tooltip>
                        </Stack>
                        
                        <Grid container spacing={2}>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary">Fair Value</Typography>
                            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                              {formatCurrency(item.valuation.fair_value)}
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary">Margin of Safety</Typography>
                            <Typography 
                              variant="h6" 
                              sx={{ 
                                fontWeight: 'bold', 
                                color: (item.valuation.upside_pct || 0) >= 0 ? 'success.main' : 'error.main' 
                              }}
                            >
                              {formatSignedPercent(item.valuation.upside_pct, 1)}
                            </Typography>
                          </Grid>
                          
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary">Market Implied Growth</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {formatPercent(item.valuation.implied_growth_10y, 1)}
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary">GF Score</Typography>
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  fontWeight: 900, 
                                  color: getGfScoreColor(item.valuation.gf_score) + '.main' 
                                }}
                              >
                                {item.valuation.gf_score ?? '-'}
                              </Typography>
                              <Typography variant="caption" color="text.disabled">/100</Typography>
                            </Stack>
                          </Grid>
                        </Grid>
                      </Box>

                      {/* Trade Plan Box */}
                      {item.trade_plan.plan_type !== 'AVOID' && (
                        <Box sx={{ mt: 2, p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                            Suggested Trade Plan
                          </Typography>
                          <Typography variant="body2" sx={{ mb: 1.5, color: 'text.secondary', lineHeight: 1.4 }}>
                            {item.trade_plan.summary}
                          </Typography>
                          <Grid container spacing={1}>
                            <Grid item xs={4}>
                              <Typography variant="caption" color="text.secondary">Entry Zone</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {formatRange(item.trade_plan.entry_low, item.trade_plan.entry_high)}
                              </Typography>
                            </Grid>
                            <Grid item xs={4}>
                              <Typography variant="caption" color="text.secondary">Stop Loss</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: 'error.main' }}>
                                {formatCurrency(item.trade_plan.stop_loss)}
                              </Typography>
                            </Grid>
                            <Grid item xs={4}>
                              <Typography variant="caption" color="text.secondary">Target (TP1)</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: 'success.main' }}>
                                {formatCurrency(item.trade_plan.take_profit_1)}
                              </Typography>
                            </Grid>
                          </Grid>
                        </Box>
                      )}

                      {/* Signal Reasons */}
                      <Box sx={{ mt: 2.5 }}>
                        <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block', mb: 1, color: 'text.secondary' }}>
                          KEY SIGNALS
                        </Typography>
                        <Stack spacing={0.5}>
                          {item.signal.reasons.slice(0, 3).map((reason, idx) => (
                            <Typography
                              key={`${item.symbol}-reason-${idx}`}
                              variant="body2"
                              color="text.secondary"
                              sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', lineHeight: 1.4 }}
                            >
                              <span style={{ color: '#10b981', fontWeight: 'bold' }}>•</span> 
                              <span>{reason}</span>
                            </Typography>
                          ))}
                          {item.signal.reasons.length > 3 && (
                            <Typography 
                              variant="caption" 
                              color="primary" 
                              sx={{ cursor: 'pointer', mt: 0.5, display: 'inline-block', fontWeight: 500 }} 
                              onClick={() => openInsights(item.symbol)}
                            >
                              + {item.signal.reasons.length - 3} more context...
                            </Typography>
                          )}
                        </Stack>
                      </Box>

                      {/* Footer Actions */}
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}
                      >
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="caption" color="text.disabled">
                            Coverage {(item.signal.data_coverage * 100).toFixed(0)}%
                          </Typography>
                          <Typography variant="caption" color="text.disabled">•</Typography>
                          <Typography variant="caption" color="text.disabled">
                            Signal Confidence {item.signal.confidence}%
                          </Typography>
                        </Stack>
                        <Button
                          size="small"
                          endIcon={<InsightsIcon />}
                          onClick={() => openInsights(item.symbol)}
                          sx={{ fontWeight: 'bold' }}
                        >
                          Deep Dive
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      </Fade>

      <StockInsightDrawer
        open={insightOpen}
        onClose={() => setInsightOpen(false)}
        loading={insightLoading}
        symbol={insightSymbol}
        insights={insightData}
      />

      <Dialog
        fullWidth
        maxWidth="lg"
        open={dcfOpen}
        onClose={() => setDcfOpen(false)}
      >
        <DialogContent sx={{ p: 0 }}>
          {dcfOpen && dcfSymbol && (
            <DCFValuationTool 
              symbol={dcfSymbol} 
              initialData={dcfInitialData} 
              onClose={() => setDcfOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Container>
    );
  } catch (err: any) {
    console.error('WatchlistPage Render Error:', err);
    return (
      <Container sx={{ py: 10 }}>
        <Alert severity="error">
          <Typography variant="h5">Watchlist Page Render Crash</Typography>
          <Typography variant="body2">{err.toString()}</Typography>
          <Button onClick={() => window.location.reload()} sx={{ mt: 2 }}>Reload Page</Button>
        </Alert>
      </Container>
    );
  }
};

export default WatchlistPage;
