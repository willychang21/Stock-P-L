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
  Collapse,
  Container,
  Divider,
  Fade,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  Add as AddIcon,
  AutoGraph as AutoGraphIcon,
  Calculate as CalculateIcon,
  DeleteOutline as DeleteOutlineIcon,
  Insights as InsightsIcon,
  Refresh as RefreshIcon,
  Schedule as ScheduleIcon,
  Search as SearchIcon,
  ShieldOutlined as ShieldOutlinedIcon,
  WarningAmberOutlined as WarningAmberOutlinedIcon,
} from '@mui/icons-material';
import { WatchlistService } from '../../application/services/WatchlistService';
import {
  WatchPlanType,
  WatchlistItem,
  WatchlistSearchItem,
} from '../../domain/models/Watchlist';
import { Dialog, DialogContent } from '@mui/material';
import ValuationScoreCell from '../components/Screener/ValuationScoreCell';
import {
  formatCurrency,
  formatNumber,
  formatRange,
  formatSignedPercent,
} from '../utils/formatters';

type WatchlistPreset =
  | 'ALL'
  | 'READY'
  | 'COMPOUNDER'
  | 'CYCLE'
  | 'PULLBACK'
  | 'RISK'
  | 'STALE';
type WatchlistSort =
  | 'CONVICTION'
  | 'TIMING'
  | 'UPSIDE'
  | 'QUALITY'
  | 'CYCLE'
  | 'RISK';

const WATCHLIST_VIEW_PREFERENCES_KEY = 'watchlist-view-preferences-v2';

const LazyStockInsightDrawer = React.lazy(
  () => import('../components/Screener/StockInsightDrawer')
);
const LazyDCFValuationTool = React.lazy(() =>
  import('../components/tools/DCFValuationTool').then(module => ({
    default: module.DCFValuationTool,
  }))
);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

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
      'STALE',
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

const planColor = (
  planType: WatchPlanType
): 'success' | 'info' | 'warning' | 'error' => {
  if (planType === 'LONG') return 'success';
  if (planType === 'WAIT') return 'info';
  if (planType === 'AVOID') return 'warning';
  return 'info';
};

const timingColor = (
  status: WatchlistItem['timing']['status']
): 'success' | 'warning' | 'info' | 'default' | 'error' => {
  if (status === 'READY') return 'success';
  if (status === 'WAIT_PULLBACK') return 'warning';
  if (status === 'WAIT_CONFIRMATION') return 'info';
  if (status === 'STALE') return 'default';
  return 'error';
};

const valueTrapColor = (
  level: WatchlistItem['value_trap']['level']
): 'success' | 'warning' | 'error' => {
  if (level === 'LOW') return 'success';
  if (level === 'MEDIUM') return 'warning';
  return 'error';
};

const cycleRiskColor = (
  level: WatchlistItem['cycle_profile']['peak_earnings_risk']
): 'success' | 'warning' | 'error' => {
  if (level === 'LOW') return 'success';
  if (level === 'MEDIUM') return 'warning';
  return 'error';
};

const cycleRegimeColor = (
  regime: WatchlistItem['cycle_profile']['earnings_regime']
): 'success' | 'info' | 'warning' | 'error' | 'default' => {
  if (regime === 'STEADY') return 'success';
  if (regime === 'TROUGH') return 'info';
  if (regime === 'MID') return 'default';
  return 'warning';
};

const qualityTone = (
  outlook: WatchlistItem['quality']['outlook']
): 'success' | 'info' | 'warning' | 'error' => {
  if (outlook === 'ELITE') return 'success';
  if (outlook === 'STRONG') return 'info';
  if (outlook === 'AVERAGE') return 'warning';
  return 'error';
};

const getUpsidePct = (item: WatchlistItem) => item.valuation.upside_pct ?? -1;
const getReferencePe = (item: WatchlistItem) => {
  const peValues = [item.forward_pe, item.trailing_pe].filter(
    (value): value is number => value !== undefined && value !== null && value > 0
  );

  if (peValues.length === 0) {
    return undefined;
  }

  return peValues.reduce((sum, value) => sum + value, 0) / peValues.length;
};
const getCycleAdjustedPe = (item: WatchlistItem) =>
  item.cycle_profile.normalized_pe;
const formatPeMultiple = (value?: number) =>
  value === undefined || value === null ? '-' : `${formatNumber(value, 1)}x`;

const getConvictionScore = (item: WatchlistItem) => {
  const upsideScore = clamp(((getUpsidePct(item) + 0.2) / 0.6) * 100, 0, 100);
  const structuralSafetyScore = 100 - item.value_trap.score;
  const cycleSafetyScore = 100 - item.cycle_profile.score;

  return Math.round(
    clamp(
      item.quality.score * 0.28 +
        item.timing.score * 0.25 +
      item.signal.confidence * 0.15 +
        upsideScore * 0.14 +
        structuralSafetyScore * 0.10 +
        cycleSafetyScore * 0.08,
      0,
      100
    )
  );
};

const matchesPreset = (item: WatchlistItem, preset: WatchlistPreset) => {
  switch (preset) {
    case 'READY':
      return item.timing.status === 'READY';
    case 'COMPOUNDER':
      return item.quality.score >= 75 && item.value_trap.level === 'LOW';
    case 'CYCLE':
      return (
        item.cycle_profile.is_cyclical &&
        item.cycle_profile.peak_earnings_risk !== 'LOW'
      );
    case 'PULLBACK':
      return item.timing.status === 'WAIT_PULLBACK';
    case 'RISK':
      return (
        item.value_trap.level === 'HIGH' ||
        item.timing.status === 'AVOID' ||
        item.cycle_profile.peak_earnings_risk === 'HIGH'
      );
    case 'STALE':
      return item.timing.status === 'STALE' || item.signal.data_coverage < 0.7;
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

const metricBarColor = (score?: number) => {
  if (score === undefined || score === null) return 'rgba(148, 163, 184, 0.45)';
  if (score >= 8) return '#34d399';
  if (score >= 6) return '#60a5fa';
  if (score >= 4) return '#f59e0b';
  return '#f87171';
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
      ready: filteredItems.filter(item => item.timing.status === 'READY')
        .length,
      cycle: filteredItems.filter(
        item => item.cycle_profile.peak_earnings_risk === 'HIGH'
      ).length,
      trap: filteredItems.filter(item => item.value_trap.level === 'HIGH')
        .length,
      stale: filteredItems.filter(
        item =>
          item.timing.status === 'STALE' || item.signal.data_coverage < 0.7
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
      READY: watchlist.filter(item => item.timing.status === 'READY').length,
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
          item.timing.status === 'AVOID' ||
          item.cycle_profile.peak_earnings_risk === 'HIGH'
      ).length,
      STALE: watchlist.filter(
        item =>
          item.timing.status === 'STALE' || item.signal.data_coverage < 0.7
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
                    'STALE',
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
                title={t('watchlist.summary.stale.title')}
                value={stats.stale}
                helper={t('watchlist.summary.stale.helper')}
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
              {filteredItems.map(item => {
                const industryLabel = [item.sector, item.industry]
                  .filter(Boolean)
                  .join(' / ');

                return (
                  <Grid key={item.symbol} item xs={12} xl={6}>
                    <Card
                      sx={{
                        height: '100%',
                        border: `1px solid ${alpha(
                          item.timing.status === 'READY'
                            ? theme.palette.success.main
                            : item.value_trap.level === 'HIGH'
                              ? theme.palette.error.main
                              : item.cycle_profile.peak_earnings_risk === 'HIGH'
                                ? theme.palette.warning.main
                              : theme.palette.common.white,
                          item.timing.status === 'READY' ||
                            item.value_trap.level === 'HIGH' ||
                            item.cycle_profile.peak_earnings_risk === 'HIGH'
                            ? 0.24
                            : 0.08
                        )}`,
                        background: `linear-gradient(180deg, ${alpha(
                          theme.palette.background.paper,
                          0.98
                        )} 0%, ${alpha('#07111f', 0.92)} 100%)`,
                        boxShadow: `0 28px 70px ${alpha(
                          theme.palette.common.black,
                          0.14
                        )}`,
                      }}
                    >
                      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                        <Stack spacing={2.25}>
                          <Stack
                            direction={{ xs: 'column', md: 'row' }}
                            spacing={2}
                            justifyContent="space-between"
                          >
                            <Box sx={{ minWidth: 0 }}>
                              <Stack
                                direction="row"
                                spacing={1}
                                alignItems="center"
                                flexWrap="wrap"
                                sx={{ rowGap: 1, mb: 1 }}
                              >
                                <Typography
                                  variant="h4"
                                  sx={{
                                    fontWeight: 900,
                                    letterSpacing: '-0.03em',
                                  }}
                                >
                                  {item.symbol}
                                </Typography>
                                <Chip
                                  size="small"
                                  color={timingColor(item.timing.status)}
                                  label={t(
                                    `watchlist.timing.statuses.${item.timing.status}`
                                  )}
                                />
                                {item.cycle_profile.is_cyclical && (
                                  <Chip
                                    size="small"
                                    color="warning"
                                    variant="outlined"
                                    label={t('watchlist.cycle.badges.cyclical')}
                                  />
                                )}
                                {item.cycle_profile.peak_earnings_risk !==
                                  'LOW' && (
                                  <Chip
                                    size="small"
                                    color={cycleRiskColor(
                                      item.cycle_profile.peak_earnings_risk
                                    )}
                                    label={t(
                                      `watchlist.cycle.risk.${item.cycle_profile.peak_earnings_risk}`
                                    )}
                                  />
                                )}
                                <Chip
                                  size="small"
                                  color={valueTrapColor(item.value_trap.level)}
                                  variant="outlined"
                                  label={t(
                                    `watchlist.valueTrap.levels.${item.value_trap.level}`
                                  )}
                                />
                                <Chip
                                  size="small"
                                  color={qualityTone(item.quality.outlook)}
                                  variant="outlined"
                                  label={t(
                                    `watchlist.quality.outlook.${item.quality.outlook}`
                                  )}
                                />
                                <ValuationScoreCell
                                  score={item.valuation_score}
                                  label={item.valuation_label}
                                  lowConfidence={item.valuation_low_confidence}
                                />
                              </Stack>

                              <Typography
                                variant="body1"
                                sx={{ fontWeight: 600, mb: 0.35 }}
                              >
                                {item.name ||
                                  t('watchlist.card.nameUnavailable')}
                              </Typography>
                              <Stack
                                direction="row"
                                spacing={1}
                                flexWrap="wrap"
                                sx={{ rowGap: 0.75 }}
                              >
                                {industryLabel && (
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    {industryLabel}
                                  </Typography>
                                )}
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {t('watchlist.card.mktCap', {
                                    value: formatCurrency(item.market_cap),
                                  })}
                                </Typography>
                              </Stack>
                            </Box>

                            <Stack
                              direction="row"
                              spacing={1.25}
                              alignItems="flex-start"
                              justifyContent="space-between"
                            >
                              <Box sx={{ textAlign: 'right' }}>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ letterSpacing: '0.08em' }}
                                >
                                  {t('watchlist.card.metrics.price')}
                                </Typography>
                                <Typography
                                  variant="h4"
                                  sx={{ fontWeight: 800, lineHeight: 1.05 }}
                                >
                                  {formatCurrency(item.price)}
                                </Typography>
                                <Typography
                                  variant="body2"
                                  sx={{
                                    color:
                                      getUpsidePct(item) >= 0
                                        ? 'success.light'
                                        : 'error.light',
                                    fontWeight: 700,
                                  }}
                                >
                                  {t('watchlist.card.metrics.margin')}
                                  {' · '}
                                  {formatSignedPercent(
                                    item.valuation.upside_pct,
                                    1
                                  )}
                                </Typography>
                              </Box>
                              <Tooltip title={t('watchlist.card.remove')}>
                                <IconButton
                                  color="error"
                                  aria-label={t('watchlist.card.removeAria', {
                                    symbol: item.symbol,
                                  })}
                                  onClick={() => handleRemove(item.symbol)}
                                >
                                  <DeleteOutlineIcon />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </Stack>

                          <Paper
                            sx={{
                              p: 1.5,
                              borderRadius: 3,
                              border: `1px solid ${alpha(
                                theme.palette.common.white,
                                0.08
                              )}`,
                              background: alpha(
                                theme.palette.common.black,
                                0.16
                              ),
                            }}
                          >
                            <Grid container spacing={1.5}>
                              <Grid item xs={6} md={3}>
                                <MetricTile
                                  label={t(
                                    'watchlist.card.metrics.fairValueRange'
                                  )}
                                  value={formatRange(
                                    item.valuation.fair_value_low,
                                    item.valuation.fair_value_high
                                  )}
                                  tone="neutral"
                                />
                              </Grid>
                              <Grid item xs={6} md={3}>
                                <MetricTile
                                  label={t('watchlist.card.metrics.headlinePe')}
                                  value={formatPeMultiple(getReferencePe(item))}
                                  tone={
                                    item.cycle_profile.peak_earnings_risk ===
                                    'HIGH'
                                      ? 'warning'
                                      : 'neutral'
                                  }
                                />
                              </Grid>
                              <Grid item xs={6} md={3}>
                                <MetricTile
                                  label={t('watchlist.card.metrics.quality')}
                                  value={formatNumber(item.quality.score, 0)}
                                  tone="info"
                                />
                              </Grid>
                              <Grid item xs={6} md={3}>
                                <MetricTile
                                  label={t('watchlist.card.metrics.timing')}
                                  value={formatNumber(item.timing.score, 0)}
                                  tone={
                                    item.timing.status === 'READY'
                                      ? 'success'
                                      : item.timing.status === 'AVOID'
                                        ? 'error'
                                        : 'warning'
                                  }
                                />
                              </Grid>
                            </Grid>
                          </Paper>

                          <Grid container spacing={1.5}>
                            <Grid item xs={12} md={6} xl={3}>
                              <InsightPanel
                                title={t('watchlist.card.sections.quality')}
                                icon={<AutoGraphIcon fontSize="small" />}
                                accent={theme.palette.success.main}
                              >
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                  sx={{ lineHeight: 1.6, mb: 1.5 }}
                                >
                                  {t(
                                    item.quality.summary.key,
                                    item.quality.summary.params
                                  )}
                                </Typography>

                                {[
                                  {
                                    key: 'profitability',
                                    value: item.quality.profitability,
                                  },
                                  {
                                    key: 'growth',
                                    value: item.quality.growth,
                                  },
                                  {
                                    key: 'financialStrength',
                                    value: item.quality.financial_strength,
                                  },
                                  {
                                    key: 'valuationSupport',
                                    value: item.quality.valuation_support,
                                  },
                                ].map(metric => (
                                  <ScoreRow
                                    key={`${item.symbol}-${metric.key}`}
                                    label={t(
                                      `watchlist.card.quality.${metric.key}`
                                    )}
                                    value={metric.value}
                                  />
                                ))}

                                <Divider
                                  sx={{ my: 1.5, borderColor: 'divider' }}
                                />

                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ display: 'block', mb: 0.75 }}
                                >
                                  {t('watchlist.card.sections.primaryDrivers')}
                                </Typography>
                                <Stack spacing={0.9}>
                                  {item.signal.reasons
                                    .slice(0, 3)
                                    .map((reason, index) => (
                                      <InsightBullet
                                        key={`${item.symbol}-driver-${index}`}
                                        text={t(reason.key, reason.params)}
                                        tone="success"
                                      />
                                    ))}
                                </Stack>
                              </InsightPanel>
                            </Grid>

                            <Grid item xs={12} md={6} xl={3}>
                              <InsightPanel
                                title={t('watchlist.card.sections.structuralTrap')}
                                icon={<ShieldOutlinedIcon fontSize="small" />}
                                accent={theme.palette.error.main}
                              >
                                <Stack
                                  direction="row"
                                  spacing={1}
                                  alignItems="center"
                                  sx={{ mb: 1.2 }}
                                >
                                  <Chip
                                    size="small"
                                    color={valueTrapColor(
                                      item.value_trap.level
                                    )}
                                    label={t(
                                      `watchlist.valueTrap.levels.${item.value_trap.level}`
                                    )}
                                  />
                                  <Typography
                                    variant="body2"
                                    sx={{ fontWeight: 700 }}
                                  >
                                    {t('watchlist.card.metrics.riskScore', {
                                      value: item.value_trap.score,
                                    })}
                                  </Typography>
                                </Stack>

                                <Stack spacing={0.9}>
                                  {item.value_trap.reasons.map(
                                    (reason, index) => (
                                      <InsightBullet
                                        key={`${item.symbol}-trap-${index}`}
                                        text={t(reason.key, reason.params)}
                                        tone={
                                          item.value_trap.level === 'LOW'
                                            ? 'success'
                                            : 'error'
                                        }
                                      />
                                    )
                                  )}
                                </Stack>

                                <Divider
                                  sx={{ my: 1.5, borderColor: 'divider' }}
                                />

                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ display: 'block', mb: 0.75 }}
                                >
                                  {t('watchlist.card.sections.technicalHeat')}
                                </Typography>
                                <Stack
                                  direction="row"
                                  spacing={0.75}
                                  flexWrap="wrap"
                                >
                                  {item.technical.warnings.length > 0 ? (
                                    item.technical.warnings.map(
                                      (warning, index) => (
                                        <Chip
                                          key={`${item.symbol}-warning-${index}`}
                                          size="small"
                                          variant="outlined"
                                          color={
                                            item.value_trap.level === 'LOW'
                                              ? 'success'
                                              : 'warning'
                                          }
                                          label={t(warning.key, warning.params)}
                                          sx={{ mb: 0.75 }}
                                        />
                                      )
                                    )
                                  ) : (
                                    <Typography
                                      variant="body2"
                                      color="text.secondary"
                                    >
                                      {t('watchlist.card.noWarnings')}
                                    </Typography>
                                  )}
                                </Stack>
                              </InsightPanel>
                            </Grid>

                            <Grid item xs={12} md={6} xl={3}>
                              <InsightPanel
                                title={t('watchlist.card.sections.cycleCheck')}
                                icon={
                                  <WarningAmberOutlinedIcon fontSize="small" />
                                }
                                accent={theme.palette.warning.main}
                              >
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                  sx={{ lineHeight: 1.6, mb: 1.5 }}
                                >
                                  {t(
                                    item.cycle_profile.summary.key,
                                    item.cycle_profile.summary.params
                                  )}
                                </Typography>

                                <Stack
                                  direction="row"
                                  spacing={0.75}
                                  flexWrap="wrap"
                                  sx={{ mb: 1.5, rowGap: 0.75 }}
                                >
                                  <Chip
                                    size="small"
                                    color={
                                      item.cycle_profile.is_cyclical
                                        ? 'warning'
                                        : 'success'
                                    }
                                    variant="outlined"
                                    label={t(
                                      item.cycle_profile.is_cyclical
                                        ? 'watchlist.cycle.badges.cyclical'
                                        : 'watchlist.cycle.badges.steady'
                                    )}
                                  />
                                  {item.cycle_profile.price_taker && (
                                    <Chip
                                      size="small"
                                      variant="outlined"
                                      color="warning"
                                      label={t(
                                        'watchlist.cycle.badges.priceTaker'
                                      )}
                                    />
                                  )}
                                  <Chip
                                    size="small"
                                    variant="outlined"
                                    color={cycleRegimeColor(
                                      item.cycle_profile.earnings_regime
                                    )}
                                    label={t(
                                      `watchlist.cycle.regimes.${item.cycle_profile.earnings_regime}`
                                    )}
                                  />
                                  <Chip
                                    size="small"
                                    color={cycleRiskColor(
                                      item.cycle_profile.peak_earnings_risk
                                    )}
                                    label={t(
                                      `watchlist.cycle.risk.${item.cycle_profile.peak_earnings_risk}`
                                    )}
                                  />
                                </Stack>

                                <Grid container spacing={1.25} sx={{ mb: 1.5 }}>
                                  <Grid item xs={6}>
                                    <MetricTile
                                      label={t(
                                        'watchlist.card.metrics.headlinePe'
                                      )}
                                      value={formatPeMultiple(
                                        getReferencePe(item)
                                      )}
                                      tone="neutral"
                                    />
                                  </Grid>
                                  <Grid item xs={6}>
                                    <MetricTile
                                      label={t(
                                        'watchlist.card.metrics.cycleAdjustedPe'
                                      )}
                                      value={formatPeMultiple(
                                        getCycleAdjustedPe(item)
                                      )}
                                      tone={
                                        item.cycle_profile.peak_earnings_risk ===
                                        'HIGH'
                                          ? 'warning'
                                          : item.cycle_profile.is_cyclical
                                            ? 'info'
                                            : 'success'
                                      }
                                    />
                                  </Grid>
                                </Grid>

                                <Stack spacing={0.9}>
                                  {item.cycle_profile.reasons.map(
                                    (reason, index) => (
                                      <InsightBullet
                                        key={`${item.symbol}-cycle-${index}`}
                                        text={t(reason.key, reason.params)}
                                        tone={
                                          item.cycle_profile.peak_earnings_risk ===
                                          'HIGH'
                                            ? 'warning'
                                            : 'success'
                                        }
                                      />
                                    )
                                  )}
                                </Stack>
                              </InsightPanel>
                            </Grid>

                            <Grid item xs={12} md={6} xl={3}>
                              <InsightPanel
                                title={t('watchlist.card.sections.timing')}
                                icon={<ScheduleIcon fontSize="small" />}
                                accent={theme.palette.info.main}
                              >
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                  sx={{ lineHeight: 1.6, mb: 1.5 }}
                                >
                                  {t(
                                    item.timing.summary.key,
                                    item.timing.summary.params
                                  )}
                                </Typography>

                                <Stack spacing={0.9}>
                                  {item.timing.conditions.map(
                                    (condition, index) => (
                                      <InsightBullet
                                        key={`${item.symbol}-timing-${index}`}
                                        text={t(
                                          condition.key,
                                          condition.params
                                        )}
                                        tone={
                                          item.timing.status === 'READY'
                                            ? 'success'
                                            : item.timing.status === 'AVOID'
                                              ? 'error'
                                              : 'warning'
                                        }
                                      />
                                    )
                                  )}
                                </Stack>

                                <Divider
                                  sx={{ my: 1.5, borderColor: 'divider' }}
                                />

                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ display: 'block', mb: 0.75 }}
                                >
                                  {t('watchlist.card.sections.valuation')}
                                </Typography>
                                <Typography
                                  variant="body2"
                                  sx={{ fontWeight: 700, mb: 0.35 }}
                                >
                                  {formatCurrency(item.valuation.fair_value)}
                                </Typography>
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  {t(
                                    item.valuation.summary.key,
                                    item.valuation.summary.params
                                  )}
                                </Typography>
                              </InsightPanel>
                            </Grid>
                          </Grid>

                          <Collapse in={showExecutionOverlay}>
                            <Paper
                              sx={{
                                p: 1.5,
                                borderRadius: 3,
                                border: `1px solid ${alpha(
                                  theme.palette.warning.main,
                                  0.22
                                )}`,
                                background: alpha(
                                  theme.palette.warning.dark,
                                  0.1
                                ),
                              }}
                            >
                              <Stack
                                direction={{ xs: 'column', sm: 'row' }}
                                spacing={1}
                                justifyContent="space-between"
                                sx={{ mb: 1.25 }}
                              >
                                <Stack
                                  direction="row"
                                  spacing={1}
                                  alignItems="center"
                                >
                                  <CalculateIcon
                                    fontSize="small"
                                    sx={{ color: theme.palette.warning.light }}
                                  />
                                  <Typography
                                    variant="subtitle2"
                                    sx={{ fontWeight: 800 }}
                                  >
                                    {t('watchlist.card.execution.title')}
                                  </Typography>
                                  <Chip
                                    size="small"
                                    color={planColor(item.trade_plan.plan_type)}
                                    label={t(
                                      `watchlist.card.plans.${item.trade_plan.plan_type}`
                                    )}
                                  />
                                </Stack>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  startIcon={<CalculateIcon fontSize="small" />}
                                  onClick={() => handleOpenDCF(item)}
                                >
                                  {t('watchlist.card.valuation.model')}
                                </Button>
                              </Stack>

                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ mb: 1.5 }}
                              >
                                {t(
                                  item.trade_plan.summary.key,
                                  item.trade_plan.summary.params
                                )}
                              </Typography>

                              <Grid container spacing={1.25}>
                                <Grid item xs={6} md={3}>
                                  <MetricTile
                                    label={t(
                                      'watchlist.card.tradePlan.entryZone'
                                    )}
                                    value={formatRange(
                                      item.trade_plan.entry_low,
                                      item.trade_plan.entry_high
                                    )}
                                    tone="neutral"
                                  />
                                </Grid>
                                <Grid item xs={6} md={3}>
                                  <MetricTile
                                    label={t(
                                      'watchlist.card.tradePlan.stopLoss'
                                    )}
                                    value={formatCurrency(
                                      item.trade_plan.stop_loss
                                    )}
                                    tone="error"
                                  />
                                </Grid>
                                <Grid item xs={6} md={3}>
                                  <MetricTile
                                    label={t('watchlist.card.tradePlan.target')}
                                    value={formatCurrency(
                                      item.trade_plan.take_profit_1
                                    )}
                                    tone="success"
                                  />
                                </Grid>
                                <Grid item xs={6} md={3}>
                                  <MetricTile
                                    label={t('watchlist.card.tradePlan.rr')}
                                    value={formatNumber(
                                      item.trade_plan.rr_to_tp1,
                                      1
                                    )}
                                    tone="warning"
                                  />
                                </Grid>
                              </Grid>
                            </Paper>
                          </Collapse>

                          <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={1.25}
                            justifyContent="space-between"
                            alignItems={{ xs: 'flex-start', sm: 'center' }}
                            sx={{
                              pt: 0.5,
                              borderTop: `1px solid ${alpha(
                                theme.palette.common.white,
                                0.08
                              )}`,
                            }}
                          >
                            <Stack
                              direction="row"
                              spacing={1}
                              flexWrap="wrap"
                              sx={{ rowGap: 0.75 }}
                            >
                              <Chip
                                size="small"
                                variant="outlined"
                                label={t('watchlist.card.coverage', {
                                  percent: (
                                    item.signal.data_coverage * 100
                                  ).toFixed(0),
                                })}
                              />
                              <Chip
                                size="small"
                                variant="outlined"
                                label={t('watchlist.card.confidence', {
                                  percent: item.signal.confidence,
                                })}
                              />
                              <Chip
                                size="small"
                                variant="outlined"
                                label={
                                  item.timing.freshness_days !== undefined &&
                                  item.timing.freshness_days !== null
                                    ? t('watchlist.card.freshness', {
                                        value: item.timing.freshness_days,
                                      })
                                    : t('watchlist.card.freshnessUnknown')
                                }
                              />
                            </Stack>

                            <Stack direction="row" spacing={1}>
                              {!showExecutionOverlay && (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  startIcon={<CalculateIcon />}
                                  onClick={() => handleOpenDCF(item)}
                                >
                                  {t('watchlist.card.valuation.model')}
                                </Button>
                              )}
                              <Button
                                size="small"
                                endIcon={<InsightsIcon />}
                                onClick={() => openInsights(item.symbol)}
                                sx={{ fontWeight: 700 }}
                              >
                                {t('watchlist.card.deepDive')}
                              </Button>
                            </Stack>
                          </Stack>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
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

const InsightPanel: React.FC<{
  title: string;
  icon: React.ReactNode;
  accent: string;
  children: React.ReactNode;
}> = ({ title, icon, accent, children }) => (
  <Paper
    sx={{
      height: '100%',
      p: 1.5,
      borderRadius: 3,
      border: `1px solid ${alpha(accent, 0.2)}`,
      background: alpha(accent, 0.04),
    }}
  >
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.25 }}>
      <Box sx={{ color: accent, display: 'flex' }}>{icon}</Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
        {title}
      </Typography>
    </Stack>
    {children}
  </Paper>
);

const ScoreRow: React.FC<{
  label: string;
  value?: number;
}> = ({ label, value }) => {
  const progress = (value ?? 0) * 10;

  return (
    <Box sx={{ mb: 1.1 }}>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.55 }}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="caption" sx={{ fontWeight: 700 }}>
          {value ? `${value}/10` : '-'}
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{
          height: 7,
          borderRadius: 999,
          bgcolor: alpha('#94a3b8', 0.16),
          '& .MuiLinearProgress-bar': {
            borderRadius: 999,
            backgroundColor: metricBarColor(value),
          },
        }}
      />
    </Box>
  );
};

const InsightBullet: React.FC<{
  text: string;
  tone: 'success' | 'warning' | 'error';
}> = ({ text, tone }) => {
  const color =
    tone === 'success' ? '#34d399' : tone === 'warning' ? '#fbbf24' : '#f87171';

  return (
    <Typography
      variant="body2"
      color="text.secondary"
      sx={{
        display: 'flex',
        gap: 1,
        alignItems: 'flex-start',
        lineHeight: 1.5,
      }}
    >
      <span style={{ color, fontWeight: 700 }}>•</span>
      <span>{text}</span>
    </Typography>
  );
};

const MetricTile: React.FC<{
  label: string;
  value: string;
  tone: 'neutral' | 'success' | 'warning' | 'error' | 'info';
}> = ({ label, value, tone }) => {
  const color =
    tone === 'success'
      ? '#34d399'
      : tone === 'warning'
        ? '#fbbf24'
        : tone === 'error'
          ? '#f87171'
          : tone === 'info'
            ? '#60a5fa'
            : '#e2e8f0';

  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontWeight: 800,
          color,
          mt: 0.35,
          wordBreak: 'break-word',
        }}
      >
        {value}
      </Typography>
    </Box>
  );
};

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
