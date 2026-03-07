import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
  SxProps,
  Theme,
  Divider,
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

// --- Styles ---
const pageStyles: Record<string, SxProps<Theme>> = {
  headerCard: {
    mb: 3,
    p: { xs: 2, md: 3 },
    borderRadius: 3,
    border: '1px solid rgba(129,140,248,0.2)',
    background:
      'radial-gradient(circle at 15% 20%, rgba(79,70,229,0.2) 0%, rgba(12,15,30,0.9) 40%, rgba(8,10,20,0.95) 100%)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  syncPaper: {
    mb: 2,
    px: 2,
    py: 1.5,
    borderRadius: 2,
    border: '1px solid rgba(255,255,255,0.08)',
    bgcolor: 'rgba(20,22,33,0.75)',
    backdropFilter: 'blur(8px)',
  },
  pulsePaper: {
    mb: 2,
    px: 2,
    py: 1.5,
    borderRadius: 2,
    border: '1px solid rgba(52,211,153,0.25)',
    bgcolor: 'rgba(12,34,28,0.45)',
    backdropFilter: 'blur(8px)',
  },
  statsCard: {
    height: '100%',
    border: '1px solid rgba(255,255,255,0.05)',
    bgcolor: 'rgba(255,255,255,0.01)',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
    },
    '& .MuiTypography-h5': {
      fontVariantNumeric: 'tabular-nums',
      fontWeight: 800,
    },
  },
  tableContainer: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    background:
      'linear-gradient(to bottom right, rgba(255,255,255,0.02), rgba(255,255,255,0))',
  },
};

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
  'valuation_score',
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
  valuation_score: true,
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
  const { t } = useTranslation();
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

  const [viewMenuAnchor, setViewMenuAnchor] = useState<null | HTMLElement>(
    null
  );
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
    if (
      key === 'sort_by' ||
      key === 'sort_order' ||
      key === 'limit' ||
      key === 'offset'
    )
      return false;
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
      const filled = coreFields.filter(
        field => stock[field] !== undefined && stock[field] !== null
      ).length;
      const quality = Math.round((filled / coreFields.length) * 100);
      const updatedAt = stock.updated_at ? new Date(stock.updated_at) : null;
      const freshnessDays = updatedAt
        ? Math.max(
            0,
            Math.floor(
              (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24)
            )
          )
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
      return (
        symbol.includes(term) || name.includes(term) || sector.includes(term)
      );
    });
  }, [enhancedStocks, searchText]);

  const selectedStocks = useMemo(() => {
    const map = new Map(visibleStocks.map(s => [s.symbol, s]));
    return selectedSymbols
      .map(symbol => map.get(symbol))
      .filter(Boolean) as ScreenerStock[];
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
          <Box sx={pageStyles.headerCard}>
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
                  {t('screener.title')}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  {t('screener.subtitle')}
                </Typography>
              </Box>

              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1.5}
                sx={{ width: { xs: '100%', md: 'auto' } }}
              >
                <Button
                  variant="outlined"
                  startIcon={<SyncIcon />}
                  onClick={triggerSyncAll}
                  sx={{
                    borderColor: 'rgba(129,140,248,0.4)',
                    '&:hover': { borderColor: 'primary.main' },
                  }}
                >
                  {t('screener.syncAll')}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<ViewColumnIcon />}
                  onClick={e => setViewMenuAnchor(e.currentTarget)}
                >
                  {t('screener.viewsColumns')}
                </Button>
                <Button
                  variant="contained"
                  startIcon={<FilterIcon />}
                  onClick={() => setSidebarOpen(true)}
                  sx={{ px: 3 }}
                >
                  {t('screener.filters')}{' '}
                  {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
                </Button>
              </Stack>
            </Stack>

            <Stack
              direction={{ xs: 'column', lg: 'row' }}
              spacing={1.5}
              sx={{ mt: 3 }}
            >
              <TextField
                size="small"
                placeholder={t('screener.searchPlaceholder')}
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                sx={{ minWidth: { xs: '100%', lg: 420 } }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon
                        fontSize="small"
                        sx={{ color: 'text.secondary' }}
                      />
                    </InputAdornment>
                  ),
                }}
              />

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {PRESET_VIEWS.map(preset => (
                  <Chip
                    key={preset.id}
                    icon={<BoltIcon />}
                    label={t(
                      `screener.menu.${preset.name.toLowerCase()}`,
                      preset.name
                    )}
                    onClick={() => applyView(preset)}
                    variant="outlined"
                    sx={{
                      borderColor: 'rgba(52,211,153,0.3)',
                      '&:hover': { borderColor: 'secondary.main' },
                    }}
                  />
                ))}
                <Chip
                  icon={<BookmarkAddIcon />}
                  label={t('screener.saveScreen')}
                  onClick={() => setSaveScreenOpen(true)}
                  variant="outlined"
                  clickable
                />
                <Chip
                  icon={<NotificationsActiveIcon />}
                  label={t('screener.checkAlerts')}
                  onClick={checkAlerts}
                  variant="outlined"
                  clickable
                />
                <Chip
                  icon={<CompareArrowsIcon />}
                  label={t('screener.compareWithCount', {
                    count: selectedSymbols.length,
                  })}
                  onClick={() => setCompareOpen(true)}
                  variant="outlined"
                  clickable
                  color={selectedSymbols.length >= 2 ? 'primary' : 'default'}
                />
                {activeFilterCount > 0 && (
                  <Chip
                    icon={<ClearIcon />}
                    label={t('screener.clearAll')}
                    onClick={clearFilters}
                    variant="outlined"
                    color="warning"
                    clickable
                  />
                )}
              </Stack>
            </Stack>
          </Box>

          <Menu
            anchorEl={viewMenuAnchor}
            open={Boolean(viewMenuAnchor)}
            onClose={() => setViewMenuAnchor(null)}
            PaperProps={{ sx: { minWidth: 200, mt: 1 } }}
          >
            <MenuItem
              onClick={() => {
                resetToCoreColumns();
                setViewMenuAnchor(null);
              }}
            >
              {t('screener.menu.coreColumns')}
            </MenuItem>
            <MenuItem
              onClick={() => {
                setSaveViewOpen(true);
                setViewMenuAnchor(null);
              }}
            >
              {t('screener.menu.saveCurrentView')}
            </MenuItem>
            <MenuItem
              onClick={() => {
                requestNotificationPermission();
                setViewMenuAnchor(null);
              }}
            >
              {t('screener.menu.enableNotifications')}
            </MenuItem>
            <Divider />
            {PRESET_VIEWS.map(view => (
              <MenuItem
                key={view.id}
                onClick={() => {
                  applyView(view);
                  setViewMenuAnchor(null);
                }}
              >
                {t('screener.menu.viewPrefix', {
                  name: t(
                    `screener.menu.${view.name.toLowerCase()}`,
                    view.name
                  ),
                })}
              </MenuItem>
            ))}
            {savedViews.length > 0 && (
              <MenuItem
                disabled
                sx={{ opacity: 0.6, fontSize: '0.75rem', mt: 1 }}
              >
                {t('screener.menu.savedViews')}
              </MenuItem>
            )}
            {savedViews.map(view => (
              <MenuItem
                key={view.id}
                onClick={() => {
                  applyView(view);
                  setViewMenuAnchor(null);
                }}
              >
                {view.name}
              </MenuItem>
            ))}
          </Menu>

          {syncError && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {syncError}
            </Alert>
          )}

          {alertEvents.length > 0 && (
            <Stack spacing={1} sx={{ mb: 2 }}>
              {alertEvents.slice(0, 3).map((event, idx) => (
                <Alert
                  key={`${event.id}-${idx}`}
                  severity="info"
                  variant="outlined"
                  sx={{ borderRadius: 2, bgcolor: 'rgba(2,132,199,0.05)' }}
                  action={
                    event.email ? (
                      <Button
                        color="info"
                        size="small"
                        onClick={() => openEmailDraft(event)}
                      >
                        Email
                      </Button>
                    ) : undefined
                  }
                >
                  <strong>{event.screenName}</strong> new matches:{' '}
                  {event.symbols.join(', ')}
                </Alert>
              ))}
            </Stack>
          )}

          {syncStatus && (
            <Paper elevation={0} sx={pageStyles.syncPaper}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', sm: 'center' }}
              >
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                >
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: syncStatus.is_running
                        ? 'secondary.main'
                        : 'text.disabled',
                    }}
                  />
                  {t('screener.sync.status')}:{' '}
                  {syncStatus.is_running
                    ? t('screener.sync.running')
                    : t('screener.sync.idle')}
                </Typography>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  {syncStatus.is_running && (
                    <CircularProgress
                      size={14}
                      thickness={6}
                      color="secondary"
                    />
                  )}
                  <Typography
                    variant="body2"
                    sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}
                  >
                    {t('screener.sync.progress', {
                      processed: syncStatus.processed,
                      total: syncStatus.total,
                      percent: syncProgressPercent,
                    })}
                  </Typography>
                </Stack>
              </Stack>
            </Paper>
          )}

          {marketPulse && (
            <Paper elevation={0} sx={pageStyles.pulsePaper}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1.5}
                alignItems={{ xs: 'flex-start', md: 'center' }}
                justifyContent="space-between"
              >
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  flexWrap="wrap"
                  useFlexGap
                >
                  <Chip
                    label={`${t('screener.marketPulse.regime')}: ${marketPulse.regime || 'N/A'}`}
                    color={
                      marketPulse.regime === 'Risk On'
                        ? 'success'
                        : marketPulse.regime === 'Risk Off'
                          ? 'error'
                          : 'default'
                    }
                    size="small"
                    variant="filled"
                    sx={{ fontWeight: 700 }}
                  />
                  <Chip
                    label={`${t('screener.marketPulse.spy5d')} ${formatPercent(marketPulse.spy_5d)}`}
                    size="small"
                    variant="outlined"
                    sx={{ fontVariantNumeric: 'tabular-nums' }}
                  />
                  <Chip
                    label={`${t('screener.marketPulse.qqq5d')} ${formatPercent(marketPulse.qqq_5d)}`}
                    size="small"
                    variant="outlined"
                    sx={{ fontVariantNumeric: 'tabular-nums' }}
                  />
                  <Chip
                    label={`${t('screener.marketPulse.vix5d')} ${formatPercent(marketPulse.vix_5d)}`}
                    size="small"
                    variant="outlined"
                    sx={{ fontVariantNumeric: 'tabular-nums' }}
                  />
                  <Chip
                    label={`${t('screener.marketPulse.vix')} ${marketPulse.vix_level?.toFixed(2) || '-'}`}
                    size="small"
                    variant="outlined"
                    sx={{ fontVariantNumeric: 'tabular-nums' }}
                  />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {t('screener.marketPulse.updatedAt', {
                    time: marketPulse.updated_at || '',
                  })}
                </Typography>
              </Stack>
            </Paper>
          )}

          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[
              { label: t('screener.stats.visibleRows'), value: summary.count },
              {
                label: t('screener.stats.avgPe'),
                value: summary.avgPe ? summary.avgPe.toFixed(1) : '-',
              },
              {
                label: t('screener.stats.avgRoic'),
                value:
                  summary.avgRoic !== null
                    ? `${(summary.avgRoic * 100).toFixed(1)}%`
                    : '-',
              },
              {
                label: t('screener.stats.avgPeg'),
                value:
                  summary.avgPeg !== null ? summary.avgPeg.toFixed(2) : '-',
              },
            ].map((stat, idx) => (
              <Grid item xs={6} md={3} key={idx}>
                <Card sx={pageStyles.statsCard}>
                  <CardContent sx={{ py: 2 }}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      fontWeight={600}
                      display="block"
                      gutterBottom
                    >
                      {stat.label}
                    </Typography>
                    <Typography variant="h5">{stat.value}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {savedScreens.length > 0 && (
            <Paper
              sx={{
                p: 2,
                mb: 2,
                borderRadius: 2,
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700 }}>
                {t('screener.savedScreens.title')}
              </Typography>
              <List dense sx={{ py: 0 }}>
                {savedScreens.map(screen => (
                  <ListItem
                    key={screen.id}
                    secondaryAction={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <FormControlLabel
                          control={
                            <Switch
                              size="small"
                              checked={screen.alerts_enabled}
                              onChange={(_, checked) =>
                                toggleScreenAlert(screen.id, checked)
                              }
                            />
                          }
                          label={t('screener.savedScreens.alert')}
                          sx={{
                            m: 0,
                            '& .MuiFormControlLabel-label': {
                              fontSize: '0.75rem',
                            },
                          }}
                        />
                        <IconButton
                          size="small"
                          onClick={() => deleteSavedScreen(screen.id)}
                          aria-label={t('common.delete')}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    }
                    sx={{
                      px: 1,
                      borderRadius: 1,
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
                    }}
                  >
                    <ListItemText
                      primary={
                        <Button
                          size="small"
                          onClick={() =>
                            setFilters({ ...filters, ...screen.filters })
                          }
                          sx={{ justifyContent: 'flex-start', fontWeight: 600 }}
                        >
                          {screen.name}
                        </Button>
                      }
                      secondary={
                        screen.email
                          ? t('screener.savedScreens.email', {
                              email: screen.email,
                            })
                          : t('screener.savedScreens.inAppOnly')
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          )}

          {savedViews.length > 0 && (
            <Paper
              sx={{
                p: 2,
                mb: 2,
                borderRadius: 2,
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700 }}>
                {t('screener.savedViews.title')}
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {savedViews.map(view => (
                  <Chip
                    key={view.id}
                    label={view.name}
                    onClick={() => applyView(view)}
                    onDelete={() => deleteSavedView(view.id)}
                    variant="outlined"
                    color="primary"
                    sx={{ fontWeight: 600 }}
                  />
                ))}
              </Stack>
            </Paper>
          )}

          <FilterPills filters={filters} onRemove={handleRemoveFilter} />

          <Paper elevation={0} sx={pageStyles.tableContainer}>
            {total === 0 && !loading ? (
              <Box sx={{ p: 10, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  {activeFilterCount > 0
                    ? t('screener.empty.noMatch')
                    : t('screener.empty.syncing')}
                </Typography>
                {activeFilterCount > 0 && (
                  <Button
                    startIcon={<ClearIcon />}
                    onClick={clearFilters}
                    variant="outlined"
                    sx={{ mt: 2 }}
                  >
                    {t('screener.empty.clearFilters')}
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
                onSelectionChange={symbols => {
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
        <DialogTitle>{t('screener.dialogs.saveView.title')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            fullWidth
            label={t('screener.dialogs.saveView.nameLabel')}
            value={newViewName}
            onChange={e => setNewViewName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveViewOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="contained" onClick={saveCurrentView}>
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={saveScreenOpen} onClose={() => setSaveScreenOpen(false)}>
        <DialogTitle>{t('screener.dialogs.saveScreen.title')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            fullWidth
            label={t('screener.dialogs.saveScreen.nameLabel')}
            value={newScreenName}
            onChange={e => setNewScreenName(e.target.value)}
            sx={{ mb: 1 }}
          />
          <TextField
            margin="dense"
            fullWidth
            label={t('screener.dialogs.saveScreen.emailLabel')}
            value={newScreenEmail}
            onChange={e => setNewScreenEmail(e.target.value)}
            placeholder={t('screener.dialogs.saveScreen.emailPlaceholder')}
          />
          <Typography variant="caption" color="text.secondary">
            {t('screener.dialogs.saveScreen.helper')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveScreenOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="contained" onClick={saveCurrentScreen}>
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ScreenerPage;
