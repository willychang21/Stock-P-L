import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Card,
  Grid,
  Typography,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Stack,
  Switch,
  FormControlLabel,
  Skeleton,
  Fade,
  useTheme,
  Divider,
  IconButton,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Timeline as TimelineIcon,
  Assessment as AssessmentIcon,
} from '@mui/icons-material';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  Tooltip as ChartTooltip,
} from 'recharts';
import { WatchlistService } from '../../../application/services/WatchlistService';
import {
  formatCurrency,
  formatPercent,
  formatNumber,
} from '../../utils/formatters';

interface DCFValuationToolProps {
  symbol: string;
  initialData?: any;
  onClose?: () => void;
}

const TACTILE_BG = 'rgba(0, 0, 0, 0.02)';
const HOVER_BG = 'rgba(0, 0, 0, 0.04)';

export const DCFValuationTool: React.FC<DCFValuationToolProps> = ({
  symbol,
  initialData,
  onClose,
}) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [historical, setHistorical] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [baseType, setBaseType] = useState<'eps' | 'fcf'>('eps');

  // Form states
  const [params, setParams] = useState({
    price: typeof initialData?.price === 'number' ? initialData.price : 0,
    base_value: 0,
    growth_rate: 0.1,
    discount_rate: 0.1,
    growth_years: 10,
    terminal_growth: 0.04,
    terminal_years: 10,
    tangible_book_value: 0,
    add_tangible_book: false,
  });

  const [result, setResult] = useState<any>(null);

  const handleSimulate = useCallback(async (currentParams: any) => {
    try {
      const res = await WatchlistService.simulateDCF({
        symbol,
        ...currentParams,
      });
      setResult(res);
    } catch (err: any) {
      console.error('Simulation failed:', err);
      setError(`Simulation failed: ${err.message}`);
    }
  }, [symbol]);

  useEffect(() => {
    const fetchData = async () => {
      if (!symbol) return;
      setLoading(true);
      try {
        const histData = await WatchlistService.fetchHistoricalFinancials(symbol);
        setHistorical(histData);

        if (histData && histData.years && histData.years.length > 0) {
          const latest = histData.years[0];
          const initialBaseValue = baseType === 'eps' 
            ? (latest.eps_nri || latest.eps || 0) 
            : (latest.fcf_per_share || 0);

          const newParams = {
            ...params,
            price: params.price || latest.price || 0,
            base_value: initialBaseValue,
            growth_rate: histData.growth_rates?.eps_nri_3y || 0.1,
            tangible_book_value: latest.book_value_per_share || 0,
          };
          setParams(newParams);
          handleSimulate(newParams);
        }
      } catch (err: any) {
        setError(`Data fetch failed: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [symbol]);

  const handleBaseTypeChange = (_: any, newType: 'eps' | 'fcf') => {
    if (!newType || !historical?.years?.[0]) return;
    setBaseType(newType);
    const latest = historical.years[0];
    const newVal = newType === 'eps' ? (latest.eps_nri || latest.eps || 0) : (latest.fcf_per_share || 0);
    const newParams = { ...params, base_value: newVal };
    setParams(newParams);
    handleSimulate(newParams);
  };

  const updateParam = (name: string, value: any) => {
    const newParams = { ...params, [name]: value };
    setParams(newParams);
    handleSimulate(newParams);
  };

  const adjustNumeric = (name: string, step: number) => {
    const newVal = Math.round(((params as any)[name] + step) * 1000) / 1000;
    updateParam(name, newVal);
  };

  const chartData = useMemo(() => {
    if (!historical?.years) return [];
    return [...historical.years].reverse().map((y: any) => ({
      year: y.date?.substring(0, 4),
      revenue: y.revenue / 1e6,
      fcf: y.fcf / 1e6,
      eps: y.eps_nri,
      price: y.price,
    }));
  }, [historical]);

  const TactileInput = ({ label, value, name, step, isPercent = false, prefix = '' }: any) => (
    <Box sx={{ mb: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </Typography>
      </Stack>
      <TextField
        fullWidth
        size="small"
        value={isPercent ? (value * 100).toFixed(1) : value}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          updateParam(name, isPercent ? v / 100 : v);
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <IconButton 
                size="small" 
                onClick={() => adjustNumeric(name, -step)} 
                sx={{ bgcolor: TACTILE_BG, '&:hover': { bgcolor: HOVER_BG } }}
              >
                <RemoveIcon fontSize="small" />
              </IconButton>
              {prefix && <Typography variant="body2" sx={{ ml: 1, color: 'text.disabled' }}>{prefix}</Typography>}
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              {isPercent && <Typography variant="body2" sx={{ mr: 1, color: 'text.disabled' }}>%</Typography>}
              <IconButton 
                size="small" 
                onClick={() => adjustNumeric(name, step)}
                sx={{ bgcolor: TACTILE_BG, '&:hover': { bgcolor: HOVER_BG } }}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ),
          sx: { 
            borderRadius: 2,
            '& .MuiInputBase-input': { textAlign: 'center', fontWeight: 700, fontSize: '1.1rem' }
          }
        }}
      />
    </Box>
  );

  if (loading) {
    return (
      <Box sx={{ p: 4 }}>
        <Skeleton variant="text" width="40%" height={40} sx={{ mb: 4 }} />
        <Grid container spacing={3}>
          <Grid item xs={12} md={7}><Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} /></Grid>
          <Grid item xs={12} md={5}><Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} /></Grid>
        </Grid>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, bgcolor: 'background.default', minHeight: '80vh' }}>
      <Fade in timeout={500}>
        <Box>
          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 4 }}>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: -1 }}>
                {symbol} <Box component="span" sx={{ color: 'text.disabled', fontWeight: 400 }}>Valuation Lab</Box>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Professional-grade Intrinsic Value Modeling
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button 
                variant="outlined" 
                color="primary" 
                startIcon={<TimelineIcon />}
                onClick={() => window.open(`https://www.gurufocus.com/stock/${symbol}/dcf`, '_blank')}
                sx={{ display: { xs: 'none', sm: 'flex' }, borderRadius: 2 }}
              >
                External Reference
              </Button>
              {onClose && <IconButton onClick={onClose} sx={{ bgcolor: 'action.hover' }}><RemoveIcon /></IconButton>}
            </Stack>
          </Stack>

          <Grid container spacing={3}>
            {/* Left: Inputs */}
            <Grid item xs={12} lg={7}>
              <Card variant="outlined" sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AssessmentIcon color="primary" /> Model Parameters
                </Typography>

                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <TactileInput label="Stock Price" name="price" value={params.price} step={1} prefix="$" />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ mb: 2 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase' }}>
                          Based On
                        </Typography>
                        <ToggleButtonGroup
                          size="small"
                          value={baseType}
                          exclusive
                          onChange={handleBaseTypeChange}
                          sx={{ height: 24 }}
                        >
                          <ToggleButton value="eps" sx={{ px: 1, fontSize: '0.65rem' }}>EPS</ToggleButton>
                          <ToggleButton value="fcf" sx={{ px: 1, fontSize: '0.65rem' }}>FCF</ToggleButton>
                        </ToggleButtonGroup>
                      </Stack>
                      <TextField
                        fullWidth
                        size="small"
                        value={params.base_value}
                        onChange={(e) => updateParam('base_value', parseFloat(e.target.value) || 0)}
                        InputProps={{
                          startAdornment: <InputAdornment position="start"><Typography variant="body2">$</Typography></InputAdornment>,
                          sx: { borderRadius: 2, fontWeight: 700 }
                        }}
                      />
                    </Box>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TactileInput label="Discount Rate" name="discount_rate" value={params.discount_rate} step={0.005} isPercent={true} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                      <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase' }}>
                        Tangible Book
                      </Typography>
                      <FormControlLabel
                        control={<Switch size="small" checked={params.add_tangible_book} onChange={(e) => updateParam('add_tangible_book', e.target.checked)} />}
                        label={<Typography variant="caption">Include</Typography>}
                        sx={{ m: 0 }}
                      />
                    </Stack>
                    <TextField
                      fullWidth
                      size="small"
                      value={params.tangible_book_value}
                      onChange={(e) => updateParam('tangible_book_value', parseFloat(e.target.value) || 0)}
                      InputProps={{
                        startAdornment: <InputAdornment position="start"><Typography variant="body2">$</Typography></InputAdornment>,
                        sx: { borderRadius: 2 }
                      }}
                    />
                  </Grid>
                </Grid>

                <Box sx={{ mt: 4, p: 2, bgcolor: 'action.hover', borderRadius: 3 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 2, color: 'primary.main' }}>Growth Trajectory</Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={6}>
                      <TactileInput label="Growth Years" name="growth_years" value={params.growth_years} step={1} />
                    </Grid>
                    <Grid item xs={6}>
                      <TactileInput label="Growth Rate" name="growth_rate" value={params.growth_rate} step={0.01} isPercent={true} />
                    </Grid>
                  </Grid>
                </Box>

                <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 3 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 2, color: 'secondary.main' }}>Terminal Stage</Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={6}>
                      <TactileInput label="Terminal Years" name="terminal_years" value={params.terminal_years} step={1} />
                    </Grid>
                    <Grid item xs={6}>
                      <TactileInput label="Terminal Growth" name="terminal_growth" value={params.terminal_growth} step={0.005} isPercent={true} />
                    </Grid>
                  </Grid>
                </Box>
              </Card>
            </Grid>

            {/* Right: Summary & Analytics */}
            <Grid item xs={12} lg={5}>
              <Stack spacing={3}>
                <Card 
                  sx={{ 
                    p: 4, 
                    borderRadius: 4, 
                    textAlign: 'center',
                    background: result?.margin_of_safety > 0 
                      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
                      : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    color: 'white',
                    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
                  }}
                >
                  <Typography variant="overline" sx={{ fontWeight: 700, opacity: 0.8, letterSpacing: 2 }}>Intrinsic Value</Typography>
                  <Typography variant="h1" sx={{ fontWeight: 900, my: 1 }}>
                    {formatCurrency(result?.fair_value)}
                  </Typography>
                  <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.2)' }} />
                  <Stack direction="row" justifyContent="space-around">
                    <Box>
                      <Typography variant="h5" sx={{ fontWeight: 800 }}>{formatPercent(result?.margin_of_safety, 1)}</Typography>
                      <Typography variant="caption" sx={{ opacity: 0.8 }}>Margin of Safety</Typography>
                    </Box>
                    <Box>
                      <Typography variant="h5" sx={{ fontWeight: 800 }}>{formatPercent(result?.implied_growth, 1)}</Typography>
                      <Typography variant="caption" sx={{ opacity: 0.8 }}>Implied Growth</Typography>
                    </Box>
                  </Stack>
                </Card>

                <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 2 }}>Expectation Analysis</Typography>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <Box sx={{ p: 1.5, borderRadius: '50%', bgcolor: result?.implied_growth > historical?.growth_rates?.eps_nri_3y ? 'error.lighter' : 'success.lighter' }}>
                      {result?.implied_growth > historical?.growth_rates?.eps_nri_3y ? <TrendingUpIcon color="error" /> : <TrendingDownIcon color="success" />}
                    </Box>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {result?.implied_growth > historical?.growth_rates?.eps_nri_3y ? 'Aggressive Expectations' : 'Conservative Expectations'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Market implies {formatPercent(result?.implied_growth, 1)} growth vs historical {formatPercent(historical?.growth_rates?.eps_nri_3y, 1)}.
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>

                {/* Mini Chart */}
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, height: 200 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, mb: 1, display: 'block', color: 'text.secondary' }}>REVENUE & FCF TREND</Typography>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <XAxis dataKey="year" hide />
                      <ChartTooltip />
                      <Bar dataKey="revenue" fill={theme.palette.primary.main} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="fcf" fill={theme.palette.secondary.main} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Paper>
              </Stack>
            </Grid>

            {/* Bottom: Detailed Table */}
            <Grid item xs={12}>
              <Box sx={{ mt: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>Historical Financials</Typography>
                  <Stack direction="row" spacing={2}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ w: 12, h: 12, bgcolor: 'primary.main', borderRadius: '50%' }} />
                      <Typography variant="caption">Revenue</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ w: 12, h: 12, bgcolor: 'secondary.main', borderRadius: '50%' }} />
                      <Typography variant="caption">FCF</Typography>
                    </Box>
                  </Stack>
                </Stack>
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'action.hover' }}>
                        <TableCell sx={{ fontWeight: 700 }}>FISCAL PERIOD</TableCell>
                        {historical?.years?.map((y: any) => (
                          <TableCell key={y.date} align="right" sx={{ fontWeight: 700 }}>{y.date?.substring(0, 7)}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow hover>
                        <TableCell sx={{ color: 'text.secondary', fontWeight: 500 }}>Revenue (M)</TableCell>
                        {historical?.years?.map((y: any) => (
                          <TableCell key={y.date} align="right" sx={{ fontWeight: 600 }}>{y.revenue ? formatNumber(y.revenue / 1e6, 0) : '-'}</TableCell>
                        ))}
                      </TableRow>
                      <TableRow hover>
                        <TableCell sx={{ color: 'text.secondary', fontWeight: 500 }}>FCF (M)</TableCell>
                        {historical?.years?.map((y: any) => (
                          <TableCell key={y.date} align="right" sx={{ fontWeight: 600 }}>{y.fcf ? formatNumber(y.fcf / 1e6, 0) : '-'}</TableCell>
                        ))}
                      </TableRow>
                      <TableRow hover>
                        <TableCell sx={{ color: 'text.secondary', fontWeight: 500 }}>EPS (Normalized)</TableCell>
                        {historical?.years?.map((y: any) => (
                          <TableCell key={y.date} align="right" sx={{ fontWeight: 600 }}>{y.eps_nri ? formatNumber(y.eps_nri, 2) : '-'}</TableCell>
                        ))}
                      </TableRow>
                      <TableRow sx={{ bgcolor: 'rgba(16,185,129,0.04)' }}>
                        <TableCell sx={{ fontWeight: 800 }}>STOCK PRICE</TableCell>
                        {historical?.years?.map((y: any) => (
                          <TableCell key={y.date} align="right" sx={{ fontWeight: 800, color: 'success.main' }}>
                            {y.price ? formatCurrency(y.price) : '-'}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Fade>
    </Box>
  );
};

