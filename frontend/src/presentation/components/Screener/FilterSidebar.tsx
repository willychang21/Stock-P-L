import React from 'react';
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
            label="Min"
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
            label="Max"
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
          <Typography variant="h6">Advanced Filters</Typography>
        </Box>
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Box>
      <Divider />

      <Box sx={{ overflowY: 'auto', flexGrow: 1, p: 2 }}>
        <Accordion defaultExpanded elevation={0} sx={{ '&:before': { display: 'none' }, bgcolor: 'transparent' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Valuation</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            {renderRangeFilter('Market Cap', 'min_mkt_cap', 'max_mkt_cap', '$')}
            {renderRangeFilter('P/E Ratio', 'min_pe', 'max_pe')}
            {renderRangeFilter('PEG Ratio', 'min_peg', 'max_peg')}
            {renderRangeFilter('P/S Ratio', 'min_ps', 'max_ps')}
            {renderRangeFilter('P/B Ratio', 'min_pb', 'max_pb')}
          </AccordionDetails>
        </Accordion>

        <Accordion defaultExpanded elevation={0} sx={{ bgcolor: 'transparent' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Profitability</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            {renderRangeFilter('ROE (decimal)', 'min_roe', 'max_roe')}
            {renderRangeFilter('ROIC (decimal)', 'min_roic', 'max_roic')}
            {renderRangeFilter('Profit Margin (decimal)', 'min_profit_margin', 'max_profit_margin')}
          </AccordionDetails>
        </Accordion>

        <Accordion elevation={0} sx={{ bgcolor: 'transparent' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Growth</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            {renderRangeFilter('Revenue Growth (decimal)', 'min_revenue_growth', 'max_revenue_growth')}
            {renderRangeFilter('EPS Growth (decimal)', 'min_eps_growth', 'max_eps_growth')}
          </AccordionDetails>
        </Accordion>

        <Accordion elevation={0} sx={{ bgcolor: 'transparent' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Cash Flow</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            {renderRangeFilter('Free Cash Flow', 'min_fcf', 'max_fcf', '$')}
          </AccordionDetails>
        </Accordion>

        <Accordion elevation={0} sx={{ bgcolor: 'transparent' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Sentiment & Ownership</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            {renderRangeFilter('Target Upside (decimal)', 'min_target_upside', 'max_target_upside')}
            {renderRangeFilter('Analyst Rating (1-5)', 'min_recommendation_mean', 'max_recommendation_mean')}
            {renderRangeFilter('Short Interest (decimal)', 'min_short_percent', 'max_short_percent')}
            {renderRangeFilter('Inst. Ownership (decimal)', 'min_inst_own', 'max_inst_own')}
            {renderRangeFilter('Insider Ownership (decimal)', 'min_insider_own', 'max_insider_own')}
          </AccordionDetails>
        </Accordion>

        <Accordion elevation={0} sx={{ bgcolor: 'transparent' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Momentum & Margins</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            {renderRangeFilter('Beta', 'min_beta', 'max_beta')}
            {renderRangeFilter('Gross Margin (decimal)', 'min_gross_margin', 'max_gross_margin')}
            {renderRangeFilter('EBITDA Margin (decimal)', 'min_ebitda_margin', 'max_ebitda_margin')}
          </AccordionDetails>
        </Accordion>

        <Accordion elevation={0} sx={{ bgcolor: 'transparent' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Other</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <TextField
              fullWidth
              label="Sector (exact name)"
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
              label="Only My Holdings"
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
                label="Has Options"
              />
            </Box>
          </AccordionDetails>
        </Accordion>
      </Box>

      <Divider />
      <Box sx={{ p: 2, display: 'flex', gap: 1.5 }}>
        <Button variant="contained" fullWidth onClick={() => { onApply(); onClose(); }}>
          Apply Filters
        </Button>
        <Button variant="outlined" fullWidth onClick={onClear}>
          Clear
        </Button>
      </Box>
    </Drawer>
  );
};

export default FilterSidebar;
