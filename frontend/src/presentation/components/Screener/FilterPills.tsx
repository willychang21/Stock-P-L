import React from 'react';
import { Box, Chip, Stack, Typography } from '@mui/material';
import { ScreenerFilters } from '../../../domain/models/ScreenerStock';

interface FilterPillsProps {
  filters: ScreenerFilters;
  onRemove: (name: string) => void;
}

const filterLabels: Record<string, string> = {
  min_mkt_cap: 'Min Mkt Cap',
  max_mkt_cap: 'Max Mkt Cap',
  min_pe: 'Min P/E',
  max_pe: 'Max P/E',
  min_ps: 'Min P/S',
  max_ps: 'Max P/S',
  min_pb: 'Min P/B',
  max_pb: 'Max P/B',
  min_peg: 'Min PEG',
  max_peg: 'Max PEG',
  min_roe: 'Min ROE',
  max_roe: 'Max ROE',
  min_roic: 'Min ROIC',
  max_roic: 'Max ROIC',
  min_profit_margin: 'Min Profit Margin',
  max_profit_margin: 'Max Profit Margin',
  min_revenue_growth: 'Min Rev Growth',
  max_revenue_growth: 'Max Rev Growth',
  min_eps_growth: 'Min EPS Growth',
  max_eps_growth: 'Max EPS Growth',
  min_fcf: 'Min FCF',
  max_fcf: 'Max FCF',
  min_target_upside: 'Min Upside',
  max_target_upside: 'Max Upside',
  min_recommendation_mean: 'Min Rating',
  max_recommendation_mean: 'Max Rating',
  min_short_percent: 'Min Short %',
  max_short_percent: 'Max Short %',
  min_inst_own: 'Min Inst Own',
  max_inst_own: 'Max Inst Own',
  min_insider_own: 'Min Insider Own',
  max_insider_own: 'Max Insider Own',
  min_beta: 'Min Beta',
  max_beta: 'Max Beta',
  min_gross_margin: 'Min Gross Margin',
  max_gross_margin: 'Max Gross Margin',
  min_ebitda_margin: 'Min EBITDA Margin',
  max_ebitda_margin: 'Max EBITDA Margin',
  has_options: 'Has Options',
  only_holdings: 'Only My Holdings',
  sector: 'Sector',
};

const formatPillValue = (key: string, value: unknown) => {
  if (value === true) return 'Yes';
  if (typeof value === 'number') {
    if (
      key.includes('growth') ||
      key.includes('margin') ||
      key.includes('upside') ||
      key.includes('percent') ||
      key === 'min_roe' ||
      key === 'max_roe' ||
      key === 'min_roic' ||
      key === 'max_roic' ||
      key === 'min_inst_own' ||
      key === 'max_inst_own' ||
      key === 'min_insider_own' ||
      key === 'max_insider_own'
    ) {
      return `${(value * 100).toFixed(1)}%`;
    }
    return value.toLocaleString();
  }
  return String(value);
};

const FilterPills: React.FC<FilterPillsProps> = ({ filters, onRemove }) => {
  const activeFilters = Object.entries(filters).filter(([key, value]) => {
    if (key === 'sort_by' || key === 'sort_order' || key === 'limit' || key === 'offset') return false;
    return value !== undefined && value !== '';
  });

  if (activeFilters.length === 0) return null;

  return (
    <Box sx={{ mb: 2 }}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Typography variant="caption" sx={{ alignSelf: 'center', fontWeight: 'bold', mr: 1 }}>
          Active Filters:
        </Typography>
        {activeFilters.map(([key, value]) => (
          <Chip
            key={key}
            label={`${filterLabels[key] || key}: ${formatPillValue(key, value)}`}
            size="small"
            onDelete={() => onRemove(key)}
            color="primary"
            variant="outlined"
            sx={{ borderRadius: '4px' }}
          />
        ))}
      </Stack>
    </Box>
  );
};

export default FilterPills;
