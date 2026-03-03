import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Button,
  Fade,
  Stack,
  TextField,
  InputAdornment,
  Chip,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  FilterList as FilterIcon,
  ClearAll as ClearIcon,
  Search as SearchIcon,
  Sync as SyncIcon,
  Bolt as BoltIcon,
  ViewColumn as ViewColumnIcon,
  BookmarkAdd as BookmarkAddIcon,
  CompareArrows as CompareArrowsIcon,
  DeleteOutline as DeleteOutlineIcon,
  NotificationsActive as NotificationsActiveIcon,
} from '@mui/icons-material';
import { GridColumnVisibilityModel } from '@mui/x-data-grid';
import ScreenerTable from '../components/Screener/ScreenerTable';
import FilterSidebar from '../components/Screener/FilterSidebar';
import FilterPills from '../components/Screener/FilterPills';
import CompareDrawer from '../components/Screener/CompareDrawer';
import StockInsightDrawer from '../components/Screener/StockInsightDrawer';
import { ScreenerService } from '../../application/services/ScreenerService';
import {
  ScreenerStock,
  ScreenerFilters,
} from '../../domain/models/ScreenerStock';

interface SyncStatus {
  is_running: boolean;
  total: number;
  processed: number;
  success: number;
  failed: number;
}
interface MarketPulse {
  spy_5d?: number;
  qqq_5d?: number;
  vix_5d?: number;
  vix_level?: number;
  regime?: string;
  updated_at?: string;
}

interface SavedView {
  id: string;
  name: string;
  visibility_model: GridColumnVisibilityModel;
  filters: ScreenerFilters;
}

interface SavedScreen {
  id: string;
  name: string;
  filters: ScreenerFilters;
  alerts_enabled: boolean;
  email?: string;
  last_matched_symbols: string[];
}

interface AlertEvent {
  id: string;
  screen_id: string;
  screenName: string;
  symbols: string[];
  email?: string;
  is_read: boolean;
  createdAt: string;
}

const CORE_COLUMNS = [
  'symbol',
  'name',
  'sector',
  'price',
  'market_cap',
  'forward_pe',
  'revenue_growth',
  'eps_growth',
  'free_cash_flow',
  'roic',
  'price_to_fcf',
  'trailing_pe',
  'peg_ratio',
  'roe',
  'data_quality_score',
  'freshness_days',
];

const createDefaultVisibilityModel = (): GridColumnVisibilityModel => ({
  symbol: true,
  name: true,
  sector: true,
  price: true,
  market_cap: true,
  forward_pe: true,
  revenue_growth: true,
  eps_growth: true,
  free_cash_flow: true,
  roic: true,
  price_to_fcf: true,
  trailing_pe: true,
  peg_ratio: true,
  roe: true,
  data_quality_score: true,
  freshness_days: true,
});

const PRESET_VIEWS: SavedView[] = [
  {
    id: 'preset-value',
    name: 'Value',
    filters: { sort_by: 'price_to_fcf', sort_order: 'asc' },
    visibility_model: {
      ...createDefaultVisibilityModel(),
      revenue_growth: false,
      eps_growth: false,
    },
  },
  {
    id: 'preset-growth',
    name: 'Growth',
    filters: { sort_by: 'revenue_growth', sort_order: 'desc' },
    visibility_model: {
      ...createDefaultVisibilityModel(),
      price_to_fcf: false,
      trailing_pe: false,
      roe: false,
    },
  },
  {
    id: 'preset-quality',
    name: 'Quality',
    filters: { sort_by: 'roic', sort_order: 'desc' },
    visibility_model: {
      ...createDefaultVisibilityModel(),
      peg_ratio: false,
    },
  },
];

const ScreenerPage: React.FC = () => {
  const [stocks, setStocks] = useState<ScreenerStock[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [insightOpen, setInsightOpen] = useState(false);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightSymbol, setInsightSymbol] = useState<string>('');
  const [insightData, setInsightData] = useState<any | null>(null);
  const [searchText, setSearchText] = useState('');
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [marketPulse, setMarketPulse] = useState<MarketPulse | null>(null);

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);

  const [filters, setFilters] = useState<ScreenerFilters>({
    sort_by: 'market_cap',
    sort_order: 'desc',
  });

  const [columnVisibilityModel, setColumnVisibilityModel] =
    useState<GridColumnVisibilityModel>(createDefaultVisibilityModel());

  const [viewMenuAnchor, setViewMenuAnchor] = useState<null | HTMLElement>(null);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [saveScreenOpen, setSaveScreenOpen] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [newScreenName, setNewScreenName] = useState('');
  const [newScreenEmail, setNewScreenEmail] = useState('');

  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [savedScreens, setSavedScreens] = useState<SavedScreen[]>([]);
  const [alertEvents, setAlertEvents] = useState<AlertEvent[]>([]);

  const fetchSyncStatus = useCallback(async () => {
    try {
      const status = await ScreenerService.getSyncStatus();
      setSyncStatus(status);
    } catch (error) {
      console.error('Failed to fetch sync status:', error);
    }
  }, []);

  const loadStocks = useCallback(async () => {
    setLoading(true);
    try {
      const response = await ScreenerService.fetchStocks({
        ...filters,
        limit: pageSize,
        offset: page * pageSize,
      });
      setStocks(response.items);
      setTotal(response.total);
    } catch (error) {
      console.error('Failed to load screener stocks:', error);
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize]);

  useEffect(() => {
    loadStocks();
  }, [loadStocks]);

  useEffect(() => {
    fetchSyncStatus();
  }, [fetchSyncStatus]);

  useEffect(() => {
    const loadPulse = async () => {
      try {
        const pulse = await ScreenerService.getMarketPulse();
        setMarketPulse(pulse);
      } catch (error) {
        console.error('Failed to load market pulse:', error);
      }
    };
    loadPulse();
    const timer = setInterval(loadPulse, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const [views, screens, alerts] = await Promise.all([
          ScreenerService.listViews(),
          ScreenerService.listScreens(),
          ScreenerService.listAlerts(50),
        ]);
        setSavedViews(views);
        setSavedScreens(screens);
        setAlertEvents(
          alerts.map((a: any) => ({
            id: a.id,
            screen_id: a.screen_id,
            screenName: a.screen_name,
            symbols: a.new_symbols || [],
            email: a.email,
            is_read: a.is_read,
            createdAt: a.created_at,
          }))
        );
      } catch (error) {
        console.error('Failed to load screener preferences:', error);
      }
    };
    bootstrap();
  }, []);

  useEffect(() => {
    if (!syncStatus?.is_running) return;
    const timer = setInterval(() => {
      fetchSyncStatus();
      loadStocks();
    }, 5000);
    return () => clearInterval(timer);
  }, [syncStatus?.is_running, fetchSyncStatus, loadStocks]);

  useEffect(() => {
    setPage(0);
  }, [searchText]);

  const handleFilterChange = (name: string, value: any) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleRemoveFilter = (name: string) => {
    setFilters(prev => {
      const next = { ...prev };
      delete (next as any)[name];
      return next;
    });
    setPage(0);
  };

  const handleSortChange = (field: string, order: 'asc' | 'desc') => {
    setFilters(prev => ({ ...prev, sort_by: field, sort_order: order }));
    setPage(0);
  };

  const clearFilters = () => {
    setFilters({ sort_by: 'market_cap', sort_order: 'desc' });
    setPage(0);
  };

  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    if (key === 'sort_by' || key === 'sort_order' || key === 'limit' || key === 'offset') return false;
    return value !== undefined && value !== '';
  }).length;

  const enhancedStocks = useMemo(() => {
    const coreFields: Array<keyof ScreenerStock> = [
      'price',
      'market_cap',
      'forward_pe',
      'revenue_growth',
      'eps_growth',
      'free_cash_flow',
      'roic',
      'price_to_fcf',
    ];

    return stocks.map(stock => {
      const filled = coreFields.filter(field => stock[field] !== undefined && stock[field] !== null).length;
      const quality = Math.round((filled / coreFields.length) * 100);
      const updatedAt = stock.updated_at ? new Date(stock.updated_at) : null;
      const freshnessDays = updatedAt
        ? Math.max(0, Math.floor((Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24)))
        : 999;

      return {
        ...stock,
        data_quality_score: quality,
        freshness_days: freshnessDays,
      };
    });
  }, [stocks]);

  const visibleStocks = useMemo(() => {
    const term = searchText.trim().toLowerCase();
    if (!term) return enhancedStocks;
    return enhancedStocks.filter(stock => {
      const symbol = stock.symbol?.toLowerCase() ?? '';
      const name = stock.name?.toLowerCase() ?? '';
      const sector = stock.sector?.toLowerCase() ?? '';
      return symbol.includes(term) || name.includes(term) || sector.includes(term);
    });
  }, [enhancedStocks, searchText]);

  const selectedStocks = useMemo(() => {
    const map = new Map(visibleStocks.map(s => [s.symbol, s]));
    return selectedSymbols.map(symbol => map.get(symbol)).filter(Boolean) as ScreenerStock[];
  }, [visibleStocks, selectedSymbols]);

  const summary = useMemo(() => {
    const avg = (items: number[]) =>
      items.length ? items.reduce((a, b) => a + b, 0) / items.length : null;

    const peList = visibleStocks
      .map(s => s.trailing_pe)
      .filter((v): v is number => v !== undefined && v !== null && v > 0);
    const roicList = visibleStocks
      .map(s => s.roic)
      .filter((v): v is number => v !== undefined && v !== null);
    const pegList = visibleStocks
      .map(s => s.peg_ratio)
      .filter((v): v is number => v !== undefined && v !== null && v > 0);

    return {
      count: visibleStocks.length,
      avgPe: avg(peList),
      avgRoic: avg(roicList),
      avgPeg: avg(pegList),
    };
  }, [visibleStocks]);

  const triggerSyncAll = async () => {
    setSyncError(null);
    try {
      await ScreenerService.syncAll();
      await fetchSyncStatus();
    } catch (error: any) {
      setSyncError(error?.message || 'Failed to start sync');
    }
  };

  const syncProgressPercent =
    syncStatus && syncStatus.total > 0
      ? Math.round((syncStatus.processed / syncStatus.total) * 100)
      : 0;

  const applyView = (view: SavedView) => {
    setColumnVisibilityModel(view.visibility_model || {});
    setFilters(prev => ({ ...prev, ...view.filters }));
    setPage(0);
  };

  const saveCurrentView = async () => {
    if (!newViewName.trim()) return;
    try {
      const created = await ScreenerService.createView({
        name: newViewName.trim(),
        visibility_model: columnVisibilityModel,
        filters,
      });
      setSavedViews(prev => [created, ...prev]);
    } catch (error) {
      console.error('Failed to save view:', error);
    }
    setSaveViewOpen(false);
    setNewViewName('');
  };

  const saveCurrentScreen = async () => {
    if (!newScreenName.trim()) return;
    try {
      const created = await ScreenerService.createScreen({
        name: newScreenName.trim(),
        filters,
        alerts_enabled: true,
        email: newScreenEmail.trim() || undefined,
      });
      setSavedScreens(prev => [created, ...prev]);
    } catch (error) {
      console.error('Failed to save screen:', error);
    }
    setSaveScreenOpen(false);
    setNewScreenName('');
    setNewScreenEmail('');
  };

  const deleteSavedView = async (id: string) => {
    try {
      await ScreenerService.deleteView(id);
      setSavedViews(prev => prev.filter(v => v.id !== id));
    } catch (error) {
      console.error('Failed to delete view:', error);
    }
  };

  const deleteSavedScreen = async (id: string) => {
    try {
      await ScreenerService.deleteScreen(id);
      setSavedScreens(prev => prev.filter(s => s.id !== id));
    } catch (error) {
      console.error('Failed to delete screen:', error);
    }
  };

  const toggleScreenAlert = async (id: string, enabled: boolean) => {
    try {
      const updated = await ScreenerService.updateScreen(id, {
        alerts_enabled: enabled,
      });
      setSavedScreens(prev =>
        prev.map(screen => (screen.id === id ? updated : screen))
      );
    } catch (error) {
      console.error('Failed to update screen alert status:', error);
    }
  };

  const openEmailDraft = (event: AlertEvent) => {
    if (!event.email) return;
    const subject = encodeURIComponent(`Screener Alert - ${event.screenName}`);
    const body = encodeURIComponent(
      `New symbols matched screen "${event.screenName}":\n${event.symbols.join(', ')}`
    );
    window.open(`mailto:${event.email}?subject=${subject}&body=${body}`);
  };

  const checkAlerts = useCallback(async () => {
    try {
      const result = await ScreenerService.checkAlerts();
      const events = (result?.events || []).map((e: any) => ({
        id: e.id,
        screen_id: e.screen_id,
        screenName: e.screen_name,
        symbols: e.new_symbols || [],
        email: e.email,
        is_read: e.is_read,
        createdAt: e.created_at,
      })) as AlertEvent[];
      if (events.length > 0) {
        setAlertEvents(prev => [...events, ...prev].slice(0, 30));
        if ('Notification' in window && Notification.permission === 'granted') {
          events.forEach(event => {
            new Notification(`Screener Alert: ${event.screenName}`, {
              body: `New matches: ${event.symbols.join(', ')}`,
            });
          });
        }
      }
      const refreshedScreens = await ScreenerService.listScreens();
      setSavedScreens(refreshedScreens);
    } catch (error) {
      console.error('Alert check failed:', error);
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      checkAlerts();
    }, 60000);
    return () => clearInterval(timer);
  }, [checkAlerts]);

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  };

  const resetToCoreColumns = () => {
    const model = createDefaultVisibilityModel();
    const normalized: GridColumnVisibilityModel = {};
    CORE_COLUMNS.forEach(col => {
      normalized[col] = model[col] !== false;
    });
    setColumnVisibilityModel(normalized);
  };

  const formatPercent = (value?: number | null) => {
    if (value === undefined || value === null) return '-';
    return `${(value * 100).toFixed(2)}%`;
  };

  const openInsights = async (symbol: string) => {
    if (!symbol) return;
    setInsightSymbol(symbol);
    setInsightOpen(true);
    setInsightLoading(true);
    try {
      const data = await ScreenerService.getSymbolInsights(symbol);
      setInsightData(data);
    } catch (error) {
      console.error('Failed to fetch symbol insights:', error);
      setInsightData(null);
    } finally {
      setInsightLoading(false);
    }
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Fade in timeout={700}>
        <Box>
          <Box
            sx={{
              mb: 3,
              p: { xs: 2, md: 3 },
              borderRadius: 3,
              border: '1px solid rgba(129,140,248,0.2)',
              background:
                'radial-gradient(circle at 15% 20%, rgba(79,70,229,0.26) 0%, rgba(12,15,30,0.88) 40%, rgba(8,10,20,0.95) 100%)',
            }}
          >
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              alignItems={{ xs: 'flex-start', md: 'center' }}
              justifyContent="space-between"
            >
              <Box>
                <Typography variant="h3" sx={{ fontWeight: 800, letterSpacing: '-0.02em', mb: 0.5 }}>
                  Screener Command Center
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  自訂欄位、儲存篩選、追蹤新命中股票
                </Typography>
              </Box>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ width: { xs: '100%', md: 'auto' } }}>
                <Button
                  variant="outlined"
                  startIcon={<SyncIcon />}
                  onClick={triggerSyncAll}
                  sx={{ borderColor: 'rgba(129,140,248,0.5)' }}
                >
                  Sync All Data
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<ViewColumnIcon />}
                  onClick={e => setViewMenuAnchor(e.currentTarget)}
                >
                  Views & Columns
                </Button>
                <Button
                  variant="contained"
                  startIcon={<FilterIcon />}
                  onClick={() => setSidebarOpen(true)}
                >
                  Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
                </Button>
              </Stack>
            </Stack>

            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.25} sx={{ mt: 2.5 }}>
              <TextField
                size="small"
                placeholder="Search symbol, name, sector on current page"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                sx={{ minWidth: { xs: '100%', lg: 420 } }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {PRESET_VIEWS.map(preset => (
                  <Chip
                    key={preset.id}
                    icon={<BoltIcon />}
                    label={preset.name}
                    onClick={() => applyView(preset)}
                    variant="outlined"
                    sx={{ borderColor: 'rgba(52,211,153,0.5)' }}
                  />
                ))}
                <Chip
                  icon={<BookmarkAddIcon />}
                  label="Save Screen"
                  onClick={() => setSaveScreenOpen(true)}
                  variant="outlined"
                />
                <Chip
                  icon={<NotificationsActiveIcon />}
                  label="Check Alerts"
                  onClick={checkAlerts}
                  variant="outlined"
                />
                <Chip
                  icon={<CompareArrowsIcon />}
                  label={`Compare (${selectedSymbols.length})`}
                  onClick={() => setCompareOpen(true)}
                  variant="outlined"
                  color={selectedSymbols.length >= 2 ? 'primary' : 'default'}
                />
                {activeFilterCount > 0 && (
                  <Chip
                    icon={<ClearIcon />}
                    label="Clear All"
                    onClick={clearFilters}
                    variant="outlined"
                    color="warning"
                  />
                )}
              </Stack>
            </Stack>
          </Box>

          <Menu
            anchorEl={viewMenuAnchor}
            open={Boolean(viewMenuAnchor)}
            onClose={() => setViewMenuAnchor(null)}
          >
            <MenuItem onClick={() => { resetToCoreColumns(); setViewMenuAnchor(null); }}>Core Columns Only</MenuItem>
            <MenuItem onClick={() => { setSaveViewOpen(true); setViewMenuAnchor(null); }}>Save Current View</MenuItem>
            <MenuItem onClick={() => { requestNotificationPermission(); setViewMenuAnchor(null); }}>Enable Browser Notifications</MenuItem>
            {PRESET_VIEWS.map(view => (
              <MenuItem key={view.id} onClick={() => { applyView(view); setViewMenuAnchor(null); }}>
                {view.name} View
              </MenuItem>
            ))}
            {savedViews.length > 0 && <MenuItem disabled>Saved Views</MenuItem>}
            {savedViews.map(view => (
              <MenuItem key={view.id} onClick={() => { applyView(view); setViewMenuAnchor(null); }}>
                {view.name}
              </MenuItem>
            ))}
          </Menu>

          {syncError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {syncError}
            </Alert>
          )}

          {alertEvents.length > 0 && (
            <Stack spacing={1} sx={{ mb: 2 }}>
              {alertEvents.slice(0, 3).map((event, idx) => (
                <Alert
                  key={`${event.id}-${idx}`}
                  severity="info"
                  action={
                    event.email ? (
                      <Button color="inherit" size="small" onClick={() => openEmailDraft(event)}>
                        Email
                      </Button>
                    ) : undefined
                  }
                >
                  <strong>{event.screenName}</strong> new matches: {event.symbols.join(', ')}
                </Alert>
              ))}
            </Stack>
          )}

          {syncStatus && (
            <Paper
              elevation={0}
              sx={{
                mb: 2,
                px: 2,
                py: 1.25,
                borderRadius: 2,
                border: '1px solid rgba(255,255,255,0.08)',
                bgcolor: 'rgba(20,22,33,0.75)',
              }}
            >
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Sync Status: {syncStatus.is_running ? 'Running' : 'Idle'}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  {syncStatus.is_running && <CircularProgress size={14} thickness={6} />}
                  <Typography variant="body2">
                    {syncStatus.processed}/{syncStatus.total} ({syncProgressPercent}%)
                  </Typography>
                </Stack>
              </Stack>
            </Paper>
          )}

          {marketPulse && (
            <Paper
              elevation={0}
              sx={{
                mb: 2,
                px: 2,
                py: 1.25,
                borderRadius: 2,
                border: '1px solid rgba(52,211,153,0.25)',
                bgcolor: 'rgba(12,34,28,0.45)',
              }}
            >
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1}
                alignItems={{ xs: 'flex-start', md: 'center' }}
                justifyContent="space-between"
              >
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Chip label={`Regime: ${marketPulse.regime || 'N/A'}`} color={marketPulse.regime === 'Risk On' ? 'success' : marketPulse.regime === 'Risk Off' ? 'error' : 'default'} size="small" variant="outlined" />
                  <Chip label={`SPY 5D ${formatPercent(marketPulse.spy_5d)}`} size="small" variant="outlined" />
                  <Chip label={`QQQ 5D ${formatPercent(marketPulse.qqq_5d)}`} size="small" variant="outlined" />
                  <Chip label={`VIX 5D ${formatPercent(marketPulse.vix_5d)}`} size="small" variant="outlined" />
                  <Chip label={`VIX ${marketPulse.vix_level?.toFixed(2) || '-'}`} size="small" variant="outlined" />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  Market Pulse {marketPulse.updated_at ? `• ${marketPulse.updated_at}` : ''}
                </Typography>
              </Stack>
            </Paper>
          )}

          <Grid container spacing={1.5} sx={{ mb: 2 }}>
            <Grid item xs={6} md={3}>
              <Card>
                <CardContent sx={{ py: 1.6 }}>
                  <Typography variant="caption" color="text.secondary">Visible Rows</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>{summary.count}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} md={3}>
              <Card>
                <CardContent sx={{ py: 1.6 }}>
                  <Typography variant="caption" color="text.secondary">Avg P/E</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {summary.avgPe ? summary.avgPe.toFixed(1) : '-'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} md={3}>
              <Card>
                <CardContent sx={{ py: 1.6 }}>
                  <Typography variant="caption" color="text.secondary">Avg ROIC</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {summary.avgRoic !== null ? `${(summary.avgRoic * 100).toFixed(1)}%` : '-'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} md={3}>
              <Card>
                <CardContent sx={{ py: 1.6 }}>
                  <Typography variant="caption" color="text.secondary">Avg PEG</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {summary.avgPeg !== null ? summary.avgPeg.toFixed(2) : '-'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {savedScreens.length > 0 && (
            <Paper sx={{ p: 1.5, mb: 2, border: '1px solid rgba(255,255,255,0.08)' }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Saved Screens</Typography>
              <List dense sx={{ py: 0 }}>
                {savedScreens.map(screen => (
                  <ListItem
                    key={screen.id}
                    secondaryAction={
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <FormControlLabel
                          control={<Switch size="small" checked={screen.alerts_enabled} onChange={(_, checked) => toggleScreenAlert(screen.id, checked)} />}
                          label="Alert"
                        />
                        <IconButton size="small" onClick={() => deleteSavedScreen(screen.id)}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    }
                    sx={{ px: 0 }}
                  >
                    <ListItemText
                      primary={
                        <Button size="small" onClick={() => setFilters({ ...filters, ...screen.filters })} sx={{ justifyContent: 'flex-start' }}>
                          {screen.name}
                        </Button>
                      }
                      secondary={screen.email ? `Email: ${screen.email}` : 'In-app alert only'}
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          )}

          {savedViews.length > 0 && (
            <Paper sx={{ p: 1.5, mb: 2, border: '1px solid rgba(255,255,255,0.08)' }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Saved Views</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {savedViews.map(view => (
                  <Chip
                    key={view.id}
                    label={view.name}
                    onClick={() => applyView(view)}
                    onDelete={() => deleteSavedView(view.id)}
                    variant="outlined"
                    color="primary"
                  />
                ))}
              </Stack>
            </Paper>
          )}

          <FilterPills filters={filters} onRemove={handleRemoveFilter} />

          <Paper
            elevation={0}
            sx={{
              width: '100%',
              overflow: 'hidden',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'linear-gradient(to bottom right, rgba(255,255,255,0.02), rgba(255,255,255,0))',
            }}
          >
            {total === 0 && !loading ? (
              <Box sx={{ p: 10, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  {activeFilterCount > 0
                    ? 'No stocks match your current filter criteria.'
                    : 'The stock database is still syncing from yfinance. Start Sync All Data to populate screener universe.'}
                </Typography>
                {activeFilterCount > 0 && (
                  <Button startIcon={<ClearIcon />} onClick={clearFilters}>
                    Clear all filters
                  </Button>
                )}
              </Box>
            ) : (
              <ScreenerTable
                stocks={visibleStocks}
                total={searchText.trim() ? visibleStocks.length : total}
                loading={loading}
                page={page}
                pageSize={pageSize}
                selectedSymbols={selectedSymbols}
                columnVisibilityModel={columnVisibilityModel}
                onColumnVisibilityModelChange={setColumnVisibilityModel}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                onSortChange={handleSortChange}
                onSelectionChange={(symbols) => {
                  const capped = symbols.slice(0, 5);
                  setSelectedSymbols(capped);
                }}
                onRowOpen={openInsights}
              />
            )}
          </Paper>
        </Box>
      </Fade>

      <FilterSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        filters={filters}
        onFilterChange={handleFilterChange}
        onApply={loadStocks}
        onClear={clearFilters}
      />

      <CompareDrawer
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        stocks={selectedStocks}
      />

      <StockInsightDrawer
        open={insightOpen}
        onClose={() => setInsightOpen(false)}
        loading={insightLoading}
        symbol={insightSymbol}
        insights={insightData}
      />

      <Dialog open={saveViewOpen} onClose={() => setSaveViewOpen(false)}>
        <DialogTitle>Save Current View</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            fullWidth
            label="View Name"
            value={newViewName}
            onChange={e => setNewViewName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveViewOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveCurrentView}>Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={saveScreenOpen} onClose={() => setSaveScreenOpen(false)}>
        <DialogTitle>Save Screen + Alerts</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            fullWidth
            label="Screen Name"
            value={newScreenName}
            onChange={e => setNewScreenName(e.target.value)}
            sx={{ mb: 1 }}
          />
          <TextField
            margin="dense"
            fullWidth
            label="Alert Email (optional)"
            value={newScreenEmail}
            onChange={e => setNewScreenEmail(e.target.value)}
            placeholder="name@example.com"
          />
          <Typography variant="caption" color="text.secondary">
            In-app alerts are always enabled. Email opens draft via mail client when alert is triggered.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveScreenOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveCurrentScreen}>Save</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ScreenerPage;
