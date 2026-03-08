import React, {
  Suspense,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
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
  FormControlLabel,
  Grid,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  Add as AddIcon,
  AutoGraph as AutoGraphIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  ShieldOutlined as ShieldOutlinedIcon,
  WarningAmberOutlined as WarningAmberOutlinedIcon,
} from '@mui/icons-material';
import { WatchlistCard } from '../components/Watchlist/WatchlistCard';
import { getConvictionScore, getDisplayState, getUpsidePct } from '../components/Watchlist/utils';
import { WatchlistService } from '../../application/services/WatchlistService';
import {
  WatchlistItem,
  WatchlistSearchItem,
} from '../../domain/models/Watchlist';
import { Dialog, DialogContent } from '@mui/material';

type WatchlistPreset =
  | 'ALL'
  | 'READY'
  | 'COMPOUNDER'
  | 'CYCLE'
  | 'PULLBACK'
  | 'RISK'
  | 'RESEARCH';
type WatchlistSort =
  | 'CONVICTION'
  | 'TIMING'
  | 'UPSIDE'
  | 'QUALITY'
  | 'CYCLE'
  | 'RISK';

const WATCHLIST_VIEW_PREFERENCES_KEY = 'watchlist-view-preferences-v3';

const LazyStockInsightDrawer = React.lazy(
  () => import('../components/Screener/StockInsightDrawer')
);
const LazyDCFValuationTool = React.lazy(() =>
  import('../components/tools/DCFValuationTool').then(module => ({
    default: module.DCFValuationTool,
  }))
);

const getStoredWatchlistPreferences = () => {
  try {
    const raw = localStorage.getItem(WATCHLIST_VIEW_PREFERENCES_KEY);
    if (!raw) {
      return {
        preset: 'ALL' as WatchlistPreset,
        sortBy: 'CONVICTION' as WatchlistSort,
        showExecutionOverlay: false,
      };
    }

    const parsed = JSON.parse(raw) as Partial<{
      preset: WatchlistPreset;
      sortBy: WatchlistSort;
      showExecutionOverlay: boolean;
    }>;

    const allowedPresets: WatchlistPreset[] = [
      'ALL',
      'READY',
      'COMPOUNDER',
      'CYCLE',
      'PULLBACK',
      'RISK',
      'RESEARCH',
    ];
    const allowedSorts: WatchlistSort[] = [
      'CONVICTION',
      'TIMING',
      'UPSIDE',
      'QUALITY',
      'CYCLE',
      'RISK',
    ];

    return {
      preset: allowedPresets.includes(parsed.preset as WatchlistPreset)
        ? (parsed.preset as WatchlistPreset)
        : 'ALL',
      sortBy: allowedSorts.includes(parsed.sortBy as WatchlistSort)
        ? (parsed.sortBy as WatchlistSort)
        : 'CONVICTION',
      showExecutionOverlay: Boolean(parsed.showExecutionOverlay),
    };
  } catch {
    return {
      preset: 'ALL' as WatchlistPreset,
      sortBy: 'CONVICTION' as WatchlistSort,
      showExecutionOverlay: false,
    };
  }
};


const matchesPreset = (item: WatchlistItem, preset: WatchlistPreset) => {
  const displayState = getDisplayState(item);

  switch (preset) {
    case 'READY':
      return displayState === 'READY';
    case 'COMPOUNDER':
      return item.quality.score >= 75 && item.value_trap.level === 'LOW';
    case 'CYCLE':
      return (
        item.cycle_profile.is_cyclical &&
        item.cycle_profile.peak_earnings_risk !== 'LOW'
      );
    case 'PULLBACK':
      return displayState === 'WAIT_PULLBACK';
    case 'RISK':
      return (
        item.value_trap.level === 'HIGH' ||
        displayState === 'AVOID' ||
        item.cycle_profile.peak_earnings_risk === 'HIGH'
      );
    case 'RESEARCH':
      return displayState === 'RESEARCH_ONLY';
    case 'ALL':
    default:
      return true;
  }
};

const compareItems = (
  left: WatchlistItem,
  right: WatchlistItem,
  sortBy: WatchlistSort
) => {
  if (sortBy === 'RISK') {
    return (
      Math.max(right.value_trap.score, right.cycle_profile.score) -
        Math.max(left.value_trap.score, left.cycle_profile.score) ||
      right.cycle_profile.score - left.cycle_profile.score ||
      right.timing.score - left.timing.score ||
      left.symbol.localeCompare(right.symbol)
    );
  }

  const leftValue =
    sortBy === 'TIMING'
      ? left.timing.score
      : sortBy === 'UPSIDE'
        ? getUpsidePct(left)
        : sortBy === 'QUALITY'
          ? left.quality.score
          : sortBy === 'CYCLE'
            ? left.cycle_profile.score
          : getConvictionScore(left);
  const rightValue =
    sortBy === 'TIMING'
      ? right.timing.score
      : sortBy === 'UPSIDE'
        ? getUpsidePct(right)
        : sortBy === 'QUALITY'
          ? right.quality.score
          : sortBy === 'CYCLE'
            ? right.cycle_profile.score
          : getConvictionScore(right);

  return (
    rightValue - leftValue ||
    right.signal.confidence - left.signal.confidence ||
    left.symbol.localeCompare(right.symbol)
  );
};


const WatchlistPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchOptions, setSearchOptions] = useState<WatchlistSearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [selectedOption, setSelectedOption] =
    useState<WatchlistSearchItem | null>(null);
  const [adding, setAdding] = useState(false);

  const [filterText, setFilterText] = useState('');
  const deferredFilterText = useDeferredValue(filterText);
  const [preset, setPreset] = useState<WatchlistPreset>(
    () => getStoredWatchlistPreferences().preset
  );
  const [sortBy, setSortBy] = useState<WatchlistSort>(
    () => getStoredWatchlistPreferences().sortBy
  );
  const [showExecutionOverlay, setShowExecutionOverlay] = useState(
    () => getStoredWatchlistPreferences().showExecutionOverlay
  );

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
    try {
      localStorage.setItem(
        WATCHLIST_VIEW_PREFERENCES_KEY,
        JSON.stringify({
          preset,
          sortBy,
          showExecutionOverlay,
        })
      );
    } catch {
      // Best-effort persistence only.
    }
  }, [preset, sortBy, showExecutionOverlay]);

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
    setInsightData(null);
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

  const handleResetView = () => {
    setFilterText('');
    setPreset('ALL');
    setSortBy('CONVICTION');
    setShowExecutionOverlay(false);
  };

  const filteredItems = useMemo(() => {
    const q = deferredFilterText.trim().toLowerCase();
    return [...watchlist]
      .filter(item => {
        if (!matchesPreset(item, preset)) return false;
        if (!q) return true;
        const haystack = [
          item.symbol,
          item.name || '',
          item.sector || '',
          item.industry || '',
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort((left, right) => compareItems(left, right, sortBy));
  }, [watchlist, deferredFilterText, preset, sortBy]);

  const stats = useMemo(
    () => ({
      ready: filteredItems.filter(item => getDisplayState(item) === 'READY')
        .length,
      cycle: filteredItems.filter(
        item => item.cycle_profile.peak_earnings_risk === 'HIGH'
      ).length,
      trap: filteredItems.filter(item => item.value_trap.level === 'HIGH')
        .length,
      research: filteredItems.filter(
        item => getDisplayState(item) === 'RESEARCH_ONLY'
      ).length,
      avgQuality:
        filteredItems.length > 0
          ? Math.round(
              filteredItems.reduce((sum, item) => sum + item.quality.score, 0) /
                filteredItems.length
            )
          : 0,
    }),
    [filteredItems]
  );

  const presetCounts = useMemo(
    () => ({
      ALL: watchlist.length,
      READY: watchlist.filter(item => getDisplayState(item) === 'READY').length,
      COMPOUNDER: watchlist.filter(
        item => item.quality.score >= 75 && item.value_trap.level === 'LOW'
      ).length,
      CYCLE: watchlist.filter(
        item =>
          item.cycle_profile.is_cyclical &&
          item.cycle_profile.peak_earnings_risk !== 'LOW'
      ).length,
      PULLBACK: watchlist.filter(item => item.timing.status === 'WAIT_PULLBACK')
        .length,
      RISK: watchlist.filter(
        item =>
          item.value_trap.level === 'HIGH' ||
          getDisplayState(item) === 'AVOID' ||
          item.cycle_profile.peak_earnings_risk === 'HIGH'
      ).length,
      RESEARCH: watchlist.filter(
        item => getDisplayState(item) === 'RESEARCH_ONLY'
      ).length,
    }),
    [watchlist]
  );

  const hasActiveFilters =
    preset !== 'ALL' ||
    filterText.trim().length > 0 ||
    sortBy !== 'CONVICTION' ||
    showExecutionOverlay;

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 6 }}>
      <Fade in timeout={650}>
        <Box>
          <Paper
            sx={{
              mb: 3,
              overflow: 'hidden',
              borderRadius: 4,
              border: `1px solid ${alpha(theme.palette.success.main, 0.28)}`,
              background: `linear-gradient(145deg, ${alpha(
                '#062a27',
                0.96
              )} 0%, ${alpha('#0b1728', 0.94)} 62%, ${alpha('#100f1f', 0.92)} 100%)`,
              boxShadow: `0 32px 90px ${alpha(theme.palette.common.black, 0.32)}`,
            }}
          >
            <Box
              sx={{
                px: { xs: 2.25, md: 3.5 },
                py: { xs: 2.5, md: 3.25 },
                backgroundImage: `radial-gradient(circle at 10% 18%, ${alpha(
                  theme.palette.success.light,
                  0.22
                )} 0%, transparent 36%), radial-gradient(circle at 84% 12%, ${alpha(
                  theme.palette.warning.light,
                  0.16
                )} 0%, transparent 28%)`,
              }}
            >
              <Stack
                direction={{ xs: 'column', xl: 'row' }}
                spacing={2.5}
                justifyContent="space-between"
              >
                <Box sx={{ maxWidth: 860 }}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    sx={{ mb: 1.5 }}
                  >
                    <Chip
                      size="small"
                      color="success"
                      label={t('watchlist.hero.mode')}
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      sx={{
                        color: 'common.white',
                        borderColor: alpha(theme.palette.common.white, 0.22),
                      }}
                      label={t('watchlist.hero.coverage', {
                        shown: filteredItems.length,
                        total: watchlist.length,
                      })}
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      sx={{
                        color: theme.palette.warning.light,
                        borderColor: alpha(theme.palette.warning.light, 0.32),
                      }}
                      label={t('watchlist.hero.avgQuality', {
                        value: stats.avgQuality,
                      })}
                    />
                  </Stack>

                  <Typography
                    variant="h3"
                    sx={{
                      fontWeight: 900,
                      letterSpacing: '-0.03em',
                      lineHeight: 1.05,
                      mb: 1,
                    }}
                  >
                    {t('watchlist.title')}
                  </Typography>
                  <Typography
                    variant="body1"
                    color="text.secondary"
                    sx={{ maxWidth: 760, lineHeight: 1.65 }}
                  >
                    {t('watchlist.subtitle')}
                  </Typography>
                </Box>

                <Stack
                  spacing={1.5}
                  alignItems={{ xs: 'stretch', xl: 'flex-end' }}
                  sx={{ minWidth: { xl: 260 } }}
                >
                  <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={loadWatchlist}
                    disabled={loading}
                    sx={{
                      borderColor: alpha(theme.palette.success.light, 0.45),
                      color: theme.palette.common.white,
                    }}
                  >
                    {t('watchlist.refresh')}
                  </Button>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={showExecutionOverlay}
                        onChange={event =>
                          setShowExecutionOverlay(event.target.checked)
                        }
                        color="warning"
                      />
                    }
                    label={t('watchlist.hero.executionOverlay')}
                    sx={{
                      mr: 0,
                      ml: 0,
                      color: 'text.secondary',
                      '& .MuiFormControlLabel-label': {
                        fontSize: 14,
                      },
                    }}
                  />
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                      maxWidth: 280,
                      textAlign: { xs: 'left', xl: 'right' },
                    }}
                  >
                    {t('watchlist.hero.executionHint')}
                  </Typography>
                </Stack>
              </Stack>

              <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
                <Grid item xs={12} lg={5}>
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
                        <Stack
                          direction="row"
                          spacing={1.2}
                          alignItems="center"
                        >
                          <Typography sx={{ fontWeight: 700, minWidth: 72 }}>
                            {option.symbol}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {option.name || t('watchlist.card.nameUnavailable')}
                          </Typography>
                        </Stack>
                      </Box>
                    )}
                    renderInput={params => (
                      <TextField
                        {...params}
                        label={t('watchlist.searchLabel')}
                        placeholder={t('watchlist.searchPlaceholder')}
                        onKeyDown={event => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            void handleAdd();
                          }
                        }}
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
                </Grid>
                <Grid item xs={12} sm={6} lg={2}>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<AddIcon />}
                    disabled={adding || (!selectedOption && !inputValue.trim())}
                    onClick={handleAdd}
                    sx={{ height: '100%' }}
                  >
                    {adding ? t('watchlist.adding') : t('watchlist.add')}
                  </Button>
                </Grid>
                <Grid item xs={12} sm={6} lg={3}>
                  <TextField
                    fullWidth
                    label={t('watchlist.filterLabel')}
                    placeholder={t('watchlist.filterPlaceholder')}
                    value={filterText}
                    onChange={event => setFilterText(event.target.value)}
                  />
                </Grid>
                <Grid item xs={12} lg={2}>
                  <TextField
                    select
                    fullWidth
                    label={t('watchlist.sort.label')}
                    value={sortBy}
                    onChange={event =>
                      setSortBy(event.target.value as WatchlistSort)
                    }
                  >
                    {(
                      [
                        'CONVICTION',
                        'TIMING',
                        'UPSIDE',
                        'QUALITY',
                        'CYCLE',
                        'RISK',
                      ] as WatchlistSort[]
                    ).map(option => (
                      <MenuItem key={option} value={option}>
                        {t(`watchlist.sort.options.${option}`)}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>

              <Stack
                direction="row"
                spacing={1}
                flexWrap="wrap"
                alignItems="center"
                sx={{ mt: 2.5, rowGap: 1 }}
              >
                {(
                  [
                    'ALL',
                    'READY',
                    'COMPOUNDER',
                    'CYCLE',
                    'PULLBACK',
                    'RISK',
                    'RESEARCH',
                  ] as WatchlistPreset[]
                ).map(option => (
                  <Chip
                    key={option}
                    clickable
                    color={preset === option ? 'primary' : 'default'}
                    variant={preset === option ? 'filled' : 'outlined'}
                    label={t(`watchlist.presets.${option}`, {
                      count: presetCounts[option],
                    })}
                    onClick={() => setPreset(option)}
                  />
                ))}
                {hasActiveFilters && (
                  <Button size="small" variant="text" onClick={handleResetView}>
                    {t('watchlist.resetView')}
                  </Button>
                )}
              </Stack>
            </Box>
          </Paper>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Grid container spacing={1.5} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={6} xl={3}>
              <SummaryCard
                title={t('watchlist.summary.ready.title')}
                value={stats.ready}
                helper={t('watchlist.summary.ready.helper')}
                icon={<AutoGraphIcon fontSize="small" />}
                accent={theme.palette.success.main}
              />
            </Grid>
            <Grid item xs={12} sm={6} xl={3}>
              <SummaryCard
                title={t('watchlist.summary.cycle.title')}
                value={stats.cycle}
                helper={t('watchlist.summary.cycle.helper')}
                icon={<WarningAmberOutlinedIcon fontSize="small" />}
                accent={theme.palette.warning.main}
              />
            </Grid>
            <Grid item xs={12} sm={6} xl={3}>
              <SummaryCard
                title={t('watchlist.summary.trap.title')}
                value={stats.trap}
                helper={t('watchlist.summary.trap.helper')}
                icon={<ShieldOutlinedIcon fontSize="small" />}
                accent={theme.palette.error.main}
              />
            </Grid>
            <Grid item xs={12} sm={6} xl={3}>
              <SummaryCard
                title={t('watchlist.summary.research.title')}
                value={stats.research}
                helper={t('watchlist.summary.research.helper')}
                icon={<RefreshIcon fontSize="small" />}
                accent={theme.palette.info.main}
              />
            </Grid>
          </Grid>

          <Alert severity="info" sx={{ mb: 2 }}>
            {t('watchlist.alert')}
          </Alert>

          {loading ? (
            <Box sx={{ py: 10, textAlign: 'center' }}>
              <CircularProgress />
            </Box>
          ) : watchlist.length === 0 ? (
            <Card sx={{ border: '1px solid rgba(255,255,255,0.08)' }}>
              <CardContent sx={{ py: 8, textAlign: 'center' }}>
                <Typography variant="h6" gutterBottom>
                  {t('watchlist.empty.title')}
                </Typography>
                <Typography color="text.secondary">
                  {t('watchlist.empty.subtitle')}
                </Typography>
              </CardContent>
            </Card>
          ) : filteredItems.length === 0 ? (
            <Card sx={{ border: '1px solid rgba(255,255,255,0.08)' }}>
              <CardContent sx={{ py: 8, textAlign: 'center' }}>
                <Typography variant="h6" gutterBottom>
                  {t('watchlist.empty.filteredTitle')}
                </Typography>
                <Typography color="text.secondary">
                  {hasActiveFilters
                    ? t('watchlist.empty.filteredSubtitle')
                    : t('watchlist.empty.subtitle')}
                </Typography>
              </CardContent>
            </Card>
          ) : (
            <Grid container spacing={1.75}>
              {filteredItems.map(item => (
                <Grid key={item.symbol} item xs={12} xl={6}>
                  <WatchlistCard
                    item={item}
                    showExecutionOverlay={showExecutionOverlay}
                    onRemove={handleRemove}
                    onOpenDCF={handleOpenDCF}
                    onOpenInsights={openInsights}
                  />
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      </Fade>

      {insightOpen && (
        <Suspense
          fallback={<OverlayLoader message={t('watchlist.loading.insights')} />}
        >
          <LazyStockInsightDrawer
            open={insightOpen}
            onClose={() => setInsightOpen(false)}
            loading={insightLoading}
            symbol={insightSymbol}
            insights={insightData}
          />
        </Suspense>
      )}

      <Dialog
        fullWidth
        maxWidth="lg"
        open={dcfOpen}
        onClose={() => setDcfOpen(false)}
      >
        <DialogContent sx={{ p: 0 }}>
          {dcfOpen && dcfSymbol && (
            <Suspense
              fallback={
                <OverlayLoader message={t('watchlist.loading.valuation')} />
              }
            >
              <LazyDCFValuationTool
                symbol={dcfSymbol}
                initialData={dcfInitialData}
                onClose={() => setDcfOpen(false)}
              />
            </Suspense>
          )}
        </DialogContent>
      </Dialog>
    </Container>
  );
};

const SummaryCard: React.FC<{
  title: string;
  value: number;
  helper: string;
  icon: React.ReactNode;
  accent: string;
}> = ({ title, value, helper, icon, accent }) => (
  <Paper
    sx={{
      height: '100%',
      borderRadius: 3,
      border: `1px solid ${alpha(accent, 0.24)}`,
      background: `linear-gradient(180deg, ${alpha(accent, 0.12)} 0%, ${alpha(
        accent,
        0.02
      )} 100%)`,
      boxShadow: `0 18px 40px ${alpha(accent, 0.08)}`,
    }}
  >
    <Box sx={{ p: 1.5 }}>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {title}
        </Typography>
        <Box sx={{ color: accent }}>{icon}</Box>
      </Stack>
      <Typography variant="h4" sx={{ fontWeight: 900, mb: 0.35 }}>
        {value}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {helper}
      </Typography>
    </Box>
  </Paper>
);



const OverlayLoader: React.FC<{ message: string }> = ({ message }) => (
  <Box
    sx={{
      minHeight: 220,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 1.5,
      p: 3,
    }}
  >
    <CircularProgress size={28} />
    <Typography variant="body2" color="text.secondary">
      {message}
    </Typography>
  </Box>
);


export default WatchlistPage;
