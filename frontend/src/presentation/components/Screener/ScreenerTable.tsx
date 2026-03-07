import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
  GridColumnVisibilityModel,
} from '@mui/x-data-grid';
import { ScreenerStock } from '../../../domain/models/ScreenerStock';
import { Box, Typography, Tooltip, Chip, SxProps, Theme } from '@mui/material';
import ValuationScoreCell from './ValuationScoreCell';

interface ScreenerTableProps {
  stocks: ScreenerStock[];
  total: number;
  loading: boolean;
  page: number;
  pageSize: number;
  selectedSymbols: string[];
  columnVisibilityModel: GridColumnVisibilityModel;
  onColumnVisibilityModelChange: (model: GridColumnVisibilityModel) => void;
  onPageChange: (newPage: number) => void;
  onPageSizeChange: (newPageSize: number) => void;
  onSortChange: (field: string, order: 'asc' | 'desc') => void;
  onSelectionChange: (symbols: string[]) => void;
  onRowOpen: (symbol: string) => void;
}

const tableStyles: SxProps<Theme> = {
  border: 'none',
  '& .MuiDataGrid-cell:focus': { outline: 'none' },
  '& .MuiDataGrid-row': {
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    cursor: 'pointer', // UX: Show clickable cursor
  },
  '& .MuiDataGrid-row:nth-of-type(even)': {
    backgroundColor: 'rgba(255,255,255,0.01)',
  },
  '& .MuiDataGrid-row:hover': {
    backgroundColor: 'rgba(129, 140, 248, 0.12)',
    transition: 'background-color 0.2s ease',
  },
  '& .MuiDataGrid-columnHeaders': {
    backgroundColor: 'rgba(24,24,27,0.9)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  },
  '& .MuiDataGrid-cell': {
    fontVariantNumeric: 'tabular-nums', // UX: Stable numeric alignment
  },
};

const hasValue = (value: number | undefined | null) =>
  value !== null && value !== undefined;

const formatCurrency = (value: number | undefined | null) => {
  if (!hasValue(value)) return '-';
  if (Math.abs(value) >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toLocaleString()}`;
};

const formatPlainNumber = (value: number | undefined | null, digits = 2) => {
  if (!hasValue(value)) return '-';
  return value.toFixed(digits);
};

const renderPercent = (value: number | undefined | null) => {
  if (!hasValue(value)) return '-';
  const val = value * 100;
  return (
    <Typography
      variant="body2"
      sx={{
        color: val > 0 ? 'secondary.main' : val < 0 ? 'error.main' : 'inherit',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {val.toFixed(2)}%
    </Typography>
  );
};

const ScreenerTable: React.FC<ScreenerTableProps> = memo(
  ({
    stocks,
    total,
    loading,
    page,
    pageSize,
    selectedSymbols,
    columnVisibilityModel,
    onColumnVisibilityModelChange,
    onPageChange,
    onPageSizeChange,
    onSortChange,
    onSelectionChange,
    onRowOpen,
  }) => {
    const { t } = useTranslation();

    const tooltipText: Record<string, string> = {
      forward_pe: t('screener.table.tooltips.forwardPe'),
      trailing_pe: t('screener.table.tooltips.trailingPe'),
      peg_ratio: t('screener.table.tooltips.pegRatio'),
      price_to_fcf: t('screener.table.tooltips.priceToFcf'),
      roic: t('screener.table.tooltips.roic'),
      roe: t('screener.table.tooltips.roe'),
      revenue_growth: t('screener.table.tooltips.revenueGrowth'),
      eps_growth: t('screener.table.tooltips.epsGrowth'),
      free_cash_flow: t('screener.table.tooltips.fcf'),
      data_quality_score: t('screener.table.tooltips.quality'),
      freshness_days: t('screener.table.tooltips.freshness'),
      valuation_score: t('screener.table.tooltips.valuationScore'),
    };

    const headerWithTip = (field: string, label: string) => (
      <Tooltip title={tooltipText[field] || label} arrow>
        <span>{label}</span>
      </Tooltip>
    );

    const columns: GridColDef[] = [
      {
        field: 'symbol',
        headerName: t('screener.table.columns.symbol'),
        minWidth: 90,
        renderCell: (params: GridRenderCellParams) => (
          <Typography
            variant="body2"
            sx={{ fontWeight: 700, color: 'primary.light' }}
          >
            {params.value}
          </Typography>
        ),
      },
      {
        field: 'name',
        headerName: t('screener.table.columns.name'),
        minWidth: 170,
        flex: 1,
      },
      {
        field: 'sector',
        headerName: t('screener.table.columns.sector'),
        minWidth: 130,
        renderCell: (params: GridRenderCellParams) => params.value || '-',
      },
      {
        field: 'price',
        headerName: t('screener.table.columns.price'),
        width: 96,
        headerAlign: 'right',
        align: 'right',
        valueFormatter: (params: any) =>
          hasValue(params.value) ? `$${Number(params.value).toFixed(2)}` : '-',
      },
      {
        field: 'market_cap',
        headerName: t('screener.table.columns.marketCap'),
        width: 116,
        headerAlign: 'right',
        align: 'right',
        valueFormatter: (params: any) => formatCurrency(params.value),
      },
      {
        field: 'forward_pe',
        headerName: t('screener.table.columns.forwardPe'),
        width: 92,
        headerAlign: 'right',
        align: 'right',
        renderHeader: () =>
          headerWithTip('forward_pe', t('screener.table.columns.forwardPe')),
        valueFormatter: (params: any) => formatPlainNumber(params.value),
      },
      {
        field: 'revenue_growth',
        headerName: t('screener.table.columns.revenueGrowth'),
        width: 105,
        headerAlign: 'right',
        align: 'right',
        renderHeader: () =>
          headerWithTip(
            'revenue_growth',
            t('screener.table.columns.revenueGrowth')
          ),
        renderCell: (params: GridRenderCellParams) =>
          renderPercent(params.value as number),
      },
      {
        field: 'eps_growth',
        headerName: t('screener.table.columns.epsGrowth'),
        width: 105,
        headerAlign: 'right',
        align: 'right',
        renderHeader: () =>
          headerWithTip('eps_growth', t('screener.table.columns.epsGrowth')),
        renderCell: (params: GridRenderCellParams) =>
          renderPercent(params.value as number),
      },
      {
        field: 'free_cash_flow',
        headerName: t('screener.table.columns.fcf'),
        width: 110,
        headerAlign: 'right',
        align: 'right',
        renderHeader: () =>
          headerWithTip('free_cash_flow', t('screener.table.columns.fcf')),
        valueFormatter: (params: any) => formatCurrency(params.value),
      },
      {
        field: 'roic',
        headerName: t('screener.table.columns.roic'),
        width: 88,
        headerAlign: 'right',
        align: 'right',
        renderHeader: () =>
          headerWithTip('roic', t('screener.table.columns.roic')),
        renderCell: (params: GridRenderCellParams) =>
          renderPercent(params.value as number),
      },
      {
        field: 'price_to_fcf',
        headerName: t('screener.table.columns.priceToFcf'),
        width: 88,
        headerAlign: 'right',
        align: 'right',
        renderHeader: () =>
          headerWithTip('price_to_fcf', t('screener.table.columns.priceToFcf')),
        valueFormatter: (params: any) => formatPlainNumber(params.value, 1),
      },
      {
        field: 'trailing_pe',
        headerName: t('screener.table.columns.trailingPe'),
        width: 82,
        headerAlign: 'right',
        align: 'right',
        renderHeader: () =>
          headerWithTip('trailing_pe', t('screener.table.columns.trailingPe')),
        valueFormatter: (params: any) => formatPlainNumber(params.value),
      },
      {
        field: 'peg_ratio',
        headerName: t('screener.table.columns.pegRatio'),
        width: 82,
        headerAlign: 'right',
        align: 'right',
        renderHeader: () =>
          headerWithTip('peg_ratio', t('screener.table.columns.pegRatio')),
        valueFormatter: (params: any) => formatPlainNumber(params.value),
      },
      {
        field: 'roe',
        headerName: t('screener.table.columns.roe'),
        width: 82,
        headerAlign: 'right',
        align: 'right',
        renderHeader: () =>
          headerWithTip('roe', t('screener.table.columns.roe')),
        renderCell: (params: GridRenderCellParams) =>
          renderPercent(params.value as number),
      },
      {
        field: 'valuation_score',
        headerName: t('screener.table.columns.valuationScore'),
        width: 104,
        headerAlign: 'center',
        align: 'center',
        sortable: true,
        renderHeader: () =>
          headerWithTip(
            'valuation_score',
            t('screener.table.columns.valuationScore')
          ),
        renderCell: (params: GridRenderCellParams) => {
          const row = params.row as ScreenerStock;
          return (
            <ValuationScoreCell
              score={row.valuation_score}
              label={row.valuation_label}
              lowConfidence={row.valuation_low_confidence}
            />
          );
        },
      },
      {
        field: 'data_quality_score',
        headerName: t('screener.table.columns.quality'),
        width: 92,
        headerAlign: 'right',
        align: 'right',
        renderHeader: () =>
          headerWithTip(
            'data_quality_score',
            t('screener.table.columns.quality')
          ),
        renderCell: (params: GridRenderCellParams) => {
          const score = Number(params.value || 0);
          const color =
            score >= 85 ? 'success' : score >= 65 ? 'warning' : 'error';
          return (
            <Chip
              label={`${score}%`}
              color={color}
              size="small"
              variant="outlined"
            />
          );
        },
      },
      {
        field: 'freshness_days',
        headerName: t('screener.table.columns.freshness'),
        width: 95,
        headerAlign: 'right',
        align: 'right',
        renderHeader: () =>
          headerWithTip(
            'freshness_days',
            t('screener.table.columns.freshness')
          ),
        renderCell: (params: GridRenderCellParams) => {
          const days = Number(params.value || 0);
          const color =
            days <= 1
              ? 'success.main'
              : days <= 3
                ? 'warning.main'
                : 'error.main';
          return (
            <Typography
              sx={{ color, fontVariantNumeric: 'tabular-nums' }}
            >{`${days}d`}</Typography>
          );
        },
      },
    ];

    return (
      <Box sx={{ height: 720, width: '100%' }}>
        <DataGrid
          rows={stocks}
          columns={columns}
          getRowId={(row: ScreenerStock) => row.symbol}
          checkboxSelection
          keepNonExistentRowsSelected
          rowSelectionModel={selectedSymbols}
          onRowSelectionModelChange={selection =>
            onSelectionChange(selection.map(String))
          }
          onRowClick={params => onRowOpen(String(params.row?.symbol || ''))}
          pagination
          paginationMode="server"
          sortingMode="server"
          rowCount={total}
          loading={loading}
          paginationModel={{ page, pageSize }}
          columnVisibilityModel={columnVisibilityModel}
          onColumnVisibilityModelChange={model =>
            onColumnVisibilityModelChange(model)
          }
          onPaginationModelChange={model => {
            onPageChange(model.page);
            onPageSizeChange(model.pageSize);
          }}
          onSortModelChange={(model: any) => {
            if (model.length > 0) {
              onSortChange(model[0].field, model[0].sort as 'asc' | 'desc');
            }
          }}
          pageSizeOptions={[25, 50, 100]}
          disableRowSelectionOnClick
          autoHeight={false}
          density="compact"
          columnHeaderHeight={44}
          sx={tableStyles}
        />
      </Box>
    );
  }
);

export default ScreenerTable;
