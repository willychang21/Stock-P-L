import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Chip, Stack, Typography } from '@mui/material';
import { ScreenerFilters } from '../../../domain/models/ScreenerStock';

interface FilterPillsProps {
  filters: ScreenerFilters;
  onRemove: (name: string) => void;
}

const FilterPills: React.FC<FilterPillsProps> = ({ filters, onRemove }) => {
  const { t } = useTranslation();

  const filterLabels: Record<string, string> = {
    min_mkt_cap: t('screener.filter_pills.labels.min_mkt_cap'),
    max_mkt_cap: t('screener.filter_pills.labels.max_mkt_cap'),
    min_pe: t('screener.filter_pills.labels.min_pe'),
    max_pe: t('screener.filter_pills.labels.max_pe'),
    min_ps: t('screener.filter_pills.labels.min_ps'),
    max_ps: t('screener.filter_pills.labels.max_ps'),
    min_pb: t('screener.filter_pills.labels.min_pb'),
    max_pb: t('screener.filter_pills.labels.max_pb'),
    min_peg: t('screener.filter_pills.labels.min_peg'),
    max_peg: t('screener.filter_pills.labels.max_peg'),
    min_roe: t('screener.filter_pills.labels.min_roe'),
    max_roe: t('screener.filter_pills.labels.max_roe'),
    min_roic: t('screener.filter_pills.labels.min_roic'),
    max_roic: t('screener.filter_pills.labels.max_roic'),
    min_profit_margin: t('screener.filter_pills.labels.min_profit_margin'),
    max_profit_margin: t('screener.filter_pills.labels.max_profit_margin'),
    min_revenue_growth: t('screener.filter_pills.labels.min_revenue_growth'),
    max_revenue_growth: t('screener.filter_pills.labels.max_revenue_growth'),
    min_eps_growth: t('screener.filter_pills.labels.min_eps_growth'),
    max_eps_growth: t('screener.filter_pills.labels.max_eps_growth'),
    min_fcf: t('screener.filter_pills.labels.min_fcf'),
    max_fcf: t('screener.filter_pills.labels.max_fcf'),
    min_target_upside: t('screener.filter_pills.labels.min_target_upside'),
    max_target_upside: t('screener.filter_pills.labels.max_target_upside'),
    min_recommendation_mean: t('screener.filter_pills.labels.min_recommendation_mean'),
    max_recommendation_mean: t('screener.filter_pills.labels.max_recommendation_mean'),
    min_short_percent: t('screener.filter_pills.labels.min_short_percent'),
    max_short_percent: t('screener.filter_pills.labels.max_short_percent'),
    min_inst_own: t('screener.filter_pills.labels.min_inst_own'),
    max_inst_own: t('screener.filter_pills.labels.max_inst_own'),
    min_insider_own: t('screener.filter_pills.labels.min_insider_own'),
    max_insider_own: t('screener.filter_pills.labels.max_insider_own'),
    min_beta: t('screener.filter_pills.labels.min_beta'),
    max_beta: t('screener.filter_pills.labels.max_beta'),
    min_gross_margin: t('screener.filter_pills.labels.min_gross_margin'),
    max_gross_margin: t('screener.filter_pills.labels.max_gross_margin'),
    min_ebitda_margin: t('screener.filter_pills.labels.min_ebitda_margin'),
    max_ebitda_margin: t('screener.filter_pills.labels.max_ebitda_margin'),
    has_options: t('screener.filter_pills.labels.has_options'),
    only_holdings: t('screener.filter_pills.labels.only_holdings'),
    sector: t('screener.filter_pills.labels.sector'),
  };

  const formatPillValue = (key: string, value: unknown) => {
    if (value === true) return t('screener.filter_pills.yes');
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

  const activeFilters = Object.entries(filters).filter(([key, value]) => {
    if (key === 'sort_by' || key === 'sort_order' || key === 'limit' || key === 'offset') return false;
    return value !== undefined && value !== '';
  });

  if (activeFilters.length === 0) return null;

  return (
    <Box sx={{ mb: 2 }}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Typography variant="caption" sx={{ alignSelf: 'center', fontWeight: 'bold', mr: 1 }}>
          {t('screener.filter_pills.activeFilters')}
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
