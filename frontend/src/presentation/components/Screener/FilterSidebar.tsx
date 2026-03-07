import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Divider,
  TextField,
  FormControlLabel,
  Checkbox,
  Grid,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  InputAdornment,
} from '@mui/material';
import {
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import { ScreenerFilters } from '../../../domain/models/ScreenerStock';

interface FilterSidebarProps {
  open: boolean;
  onClose: () => void;
  filters: ScreenerFilters;
  onFilterChange: (name: string, value: any) => void;
  onApply: () => void;
  onClear: () => void;
}

const FilterSidebar: React.FC<FilterSidebarProps> = ({
  open,
  onClose,
  filters,
  onFilterChange,
  onApply,
  onClear,
}) => {
  const { t } = useTranslation();
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;

    if (type === 'checkbox') {
      onFilterChange(name, checked ? true : undefined);
      return;
    }

    if (name === 'sector') {
      onFilterChange(name, value.trim() === '' ? undefined : value);
      return;
    }

    onFilterChange(name, value === '' ? undefined : Number(value));
  };

  const renderRangeFilter = (
    label: string,
    minName: string,
    maxName: string,
    suffix?: string
  ) => (
    <Box sx={{ mb: 2.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
        {label}
      </Typography>
      <Grid container spacing={1.25}>
        <Grid item xs={6}>
          <TextField
            fullWidth
            label={t('screener.filters_sidebar.min')}
            name={minName}
            type="number"
            value={(filters as any)[minName] ?? ''}
            onChange={handleInputChange}
            size="small"
            InputProps={suffix ? { endAdornment: <InputAdornment position="end">{suffix}</InputAdornment> } : undefined}
          />
        </Grid>
        <Grid item xs={6}>
          <TextField
            fullWidth
            label={t('screener.filters_sidebar.max')}
            name={maxName}
            type="number"
            value={(filters as any)[maxName] ?? ''}
            onChange={handleInputChange}
            size="small"
            InputProps={suffix ? { endAdornment: <InputAdornment position="end">{suffix}</InputAdornment> } : undefined}
          />
        </Grid>
      </Grid>
    </Box>
  );

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 410 },
          p: 0,
          borderLeft: '1px solid rgba(129, 140, 248, 0.25)',
          background:
            'linear-gradient(180deg, rgba(12,15,30,0.96) 0%, rgba(10,12,24,0.98) 100%)',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', p: 2, justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FilterIcon sx={{ color: 'primary.light' }} />
          <Typography variant="h6">{t('screener.filters_sidebar.title')}</Typography>
        </Box>
        <IconButton onClick={onClose} aria-label={t('common.close')}>
          <CloseIcon />
        </IconButton>
      </Box>
      <Divider />

      <Box sx={{ overflowY: 'auto', flexGrow: 1, p: 2 }}>
        <Accordion defaultExpanded elevation={0} sx={{ '&:before': { display: 'none' }, bgcolor: 'transparent' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{t('screener.filters_sidebar.valuation')}</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            {renderRangeFilter(t('screener.filters_sidebar.labels.marketCap'), 'min_mkt_cap', 'max_mkt_cap', '$')}
            {renderRangeFilter(t('screener.filters_sidebar.labels.peRatio'), 'min_pe', 'max_pe')}
            {renderRangeFilter(t('screener.filters_sidebar.labels.pegRatio'), 'min_peg', 'max_peg')}
            {renderRangeFilter(t('screener.filters_sidebar.labels.psRatio'), 'min_ps', 'max_ps')}
            {renderRangeFilter(t('screener.filters_sidebar.labels.pbRatio'), 'min_pb', 'max_pb')}
          </AccordionDetails>
        </Accordion>

        <Accordion defaultExpanded elevation={0} sx={{ bgcolor: 'transparent' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{t('screener.filters_sidebar.profitability')}</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            {renderRangeFilter(t('screener.filters_sidebar.labels.roe'), 'min_roe', 'max_roe')}
            {renderRangeFilter(t('screener.filters_sidebar.labels.roic'), 'min_roic', 'max_roic')}
            {renderRangeFilter(t('screener.filters_sidebar.labels.profitMargin'), 'min_profit_margin', 'max_profit_margin')}
          </AccordionDetails>
        </Accordion>

        <Accordion elevation={0} sx={{ bgcolor: 'transparent' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{t('screener.filters_sidebar.growth')}</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            {renderRangeFilter(t('screener.filters_sidebar.labels.revenueGrowth'), 'min_revenue_growth', 'max_revenue_growth')}
            {renderRangeFilter(t('screener.filters_sidebar.labels.epsGrowth'), 'min_eps_growth', 'max_eps_growth')}
          </AccordionDetails>
        </Accordion>

        <Accordion elevation={0} sx={{ bgcolor: 'transparent' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{t('screener.filters_sidebar.cashFlow')}</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            {renderRangeFilter(t('screener.filters_sidebar.labels.fcf'), 'min_fcf', 'max_fcf', '$')}
          </AccordionDetails>
        </Accordion>

        <Accordion elevation={0} sx={{ bgcolor: 'transparent' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{t('screener.filters_sidebar.sentiment')}</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            {renderRangeFilter(t('screener.filters_sidebar.labels.targetUpside'), 'min_target_upside', 'max_target_upside')}
            {renderRangeFilter(t('screener.filters_sidebar.labels.analystRating'), 'min_recommendation_mean', 'max_recommendation_mean')}
            {renderRangeFilter(t('screener.filters_sidebar.labels.shortInterest'), 'min_short_percent', 'max_short_percent')}
            {renderRangeFilter(t('screener.filters_sidebar.labels.instOwnership'), 'min_inst_own', 'max_inst_own')}
            {renderRangeFilter(t('screener.filters_sidebar.labels.insiderOwnership'), 'min_insider_own', 'max_insider_own')}
          </AccordionDetails>
        </Accordion>

        <Accordion elevation={0} sx={{ bgcolor: 'transparent' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{t('screener.filters_sidebar.momentum')}</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            {renderRangeFilter(t('screener.filters_sidebar.labels.beta'), 'min_beta', 'max_beta')}
            {renderRangeFilter(t('screener.filters_sidebar.labels.grossMargin'), 'min_gross_margin', 'max_gross_margin')}
            {renderRangeFilter(t('screener.filters_sidebar.labels.ebitdaMargin'), 'min_ebitda_margin', 'max_ebitda_margin')}
          </AccordionDetails>
        </Accordion>

        <Accordion elevation={0} sx={{ bgcolor: 'transparent' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{t('screener.filters_sidebar.other')}</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <TextField
              fullWidth
              label={t('screener.filters_sidebar.labels.sector')}
              name="sector"
              value={filters.sector ?? ''}
              onChange={handleInputChange}
              size="small"
              sx={{ mb: 2 }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  name="only_holdings"
                  checked={filters.only_holdings === true}
                  onChange={handleInputChange}
                />
              }
              label={t('screener.filters_sidebar.labels.onlyHoldings')}
            />
            <Box sx={{ mt: 0.5 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    name="has_options"
                    checked={filters.has_options === true}
                    onChange={handleInputChange}
                  />
                }
                label={t('screener.filters_sidebar.labels.hasOptions')}
              />
            </Box>
          </AccordionDetails>
        </Accordion>
      </Box>

      <Divider />
      <Box sx={{ p: 2, display: 'flex', gap: 1.5 }}>
        <Button variant="contained" fullWidth onClick={() => { onApply(); onClose(); }}>
          {t('screener.filters_sidebar.apply')}
        </Button>
        <Button variant="outlined" fullWidth onClick={onClear}>
          {t('screener.filters_sidebar.clear')}
        </Button>
      </Box>
    </Drawer>
  );
};

export default FilterSidebar;
