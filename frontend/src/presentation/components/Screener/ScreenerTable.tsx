import React from 'react';
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
  GridColumnVisibilityModel,
} from '@mui/x-data-grid';
import { ScreenerStock } from '../../../domain/models/ScreenerStock';
import { Box, Typography, Tooltip, Chip } from '@mui/material';

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
      }}
    >
      {val.toFixed(2)}%
    </Typography>
  );
};

const tooltipText: Record<string, string> = {
  forward_pe: 'Forward P/E = Price / Next 12M expected EPS. Better for forward-looking valuation.',
  trailing_pe: 'P/E = Price / trailing 12M EPS. Can be misleading in cyclical earnings periods.',
  peg_ratio: 'PEG = P/E divided by EPS growth rate. Use with stable growth assumptions.',
  price_to_fcf:
    'P/FCF = Market Cap / Free Cash Flow. For banks/insurers, this can be less meaningful.',
  roic:
    'ROIC = NOPAT / Invested Capital. Higher is better; compare within the same industry.',
  roe: 'ROE = Net Income / Shareholder Equity. Can be inflated by high leverage or low equity base.',
  revenue_growth: 'Revenue growth YoY. Check quality of growth, not only the headline number.',
  eps_growth: 'EPS growth YoY. Sensitive to buybacks and accounting effects.',
  free_cash_flow: 'Free Cash Flow = Operating Cash Flow - Capex. Key measure for capital allocation.',
  data_quality_score:
    'Data quality score = filled core fields / total core fields. Lower score means more missing fundamentals.',
  freshness_days:
    'Freshness = days since last backend update from yfinance. Older data carries higher decision risk.',
};

const headerWithTip = (field: string, label: string) => (
  <Tooltip title={tooltipText[field] || label}>
    <span>{label}</span>
  </Tooltip>
);

const ScreenerTable: React.FC<ScreenerTableProps> = ({
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
  const columns: GridColDef[] = [
    {
      field: 'symbol',
      headerName: 'Symbol',
      minWidth: 90,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main' }}>
          {params.value}
        </Typography>
      ),
    },
    { field: 'name', headerName: 'Name', minWidth: 170, flex: 1 },
    {
      field: 'sector',
      headerName: 'Sector',
      minWidth: 130,
      renderCell: (params: GridRenderCellParams) => params.value || '-',
    },
    {
      field: 'price',
      headerName: 'Price',
      width: 96,
      headerAlign: 'right',
      align: 'right',
      valueFormatter: (params: any) =>
        hasValue(params.value) ? `$${Number(params.value).toFixed(2)}` : '-',
    },
    {
      field: 'market_cap',
      headerName: 'Mkt Cap',
      width: 116,
      headerAlign: 'right',
      align: 'right',
      valueFormatter: (params: any) => formatCurrency(params.value),
    },
    {
      field: 'forward_pe',
      headerName: 'Fwd P/E',
      width: 92,
      headerAlign: 'right',
      align: 'right',
      renderHeader: () => headerWithTip('forward_pe', 'Fwd P/E'),
      valueFormatter: (params: any) => formatPlainNumber(params.value),
    },
    {
      field: 'revenue_growth',
      headerName: 'Rev Growth',
      width: 105,
      headerAlign: 'right',
      align: 'right',
      renderHeader: () => headerWithTip('revenue_growth', 'Rev Growth'),
      renderCell: (params: GridRenderCellParams) => renderPercent(params.value as number),
    },
    {
      field: 'eps_growth',
      headerName: 'EPS Growth',
      width: 105,
      headerAlign: 'right',
      align: 'right',
      renderHeader: () => headerWithTip('eps_growth', 'EPS Growth'),
      renderCell: (params: GridRenderCellParams) => renderPercent(params.value as number),
    },
    {
      field: 'free_cash_flow',
      headerName: 'FCF',
      width: 110,
      headerAlign: 'right',
      align: 'right',
      renderHeader: () => headerWithTip('free_cash_flow', 'FCF'),
      valueFormatter: (params: any) => formatCurrency(params.value),
    },
    {
      field: 'roic',
      headerName: 'ROIC',
      width: 88,
      headerAlign: 'right',
      align: 'right',
      renderHeader: () => headerWithTip('roic', 'ROIC'),
      renderCell: (params: GridRenderCellParams) => renderPercent(params.value as number),
    },
    {
      field: 'price_to_fcf',
      headerName: 'P/FCF',
      width: 88,
      headerAlign: 'right',
      align: 'right',
      renderHeader: () => headerWithTip('price_to_fcf', 'P/FCF'),
      valueFormatter: (params: any) => formatPlainNumber(params.value, 1),
    },
    {
      field: 'trailing_pe',
      headerName: 'P/E',
      width: 82,
      headerAlign: 'right',
      align: 'right',
      renderHeader: () => headerWithTip('trailing_pe', 'P/E'),
      valueFormatter: (params: any) => formatPlainNumber(params.value),
    },
    {
      field: 'peg_ratio',
      headerName: 'PEG',
      width: 82,
      headerAlign: 'right',
      align: 'right',
      renderHeader: () => headerWithTip('peg_ratio', 'PEG'),
      valueFormatter: (params: any) => formatPlainNumber(params.value),
    },
    {
      field: 'roe',
      headerName: 'ROE',
      width: 82,
      headerAlign: 'right',
      align: 'right',
      renderHeader: () => headerWithTip('roe', 'ROE'),
      renderCell: (params: GridRenderCellParams) => renderPercent(params.value as number),
    },
    {
      field: 'data_quality_score',
      headerName: 'Quality',
      width: 92,
      headerAlign: 'right',
      align: 'right',
      renderHeader: () => headerWithTip('data_quality_score', 'Quality'),
      renderCell: (params: GridRenderCellParams) => {
        const score = Number(params.value || 0);
        const color = score >= 85 ? 'success' : score >= 65 ? 'warning' : 'error';
        return <Chip label={`${score}%`} color={color} size="small" variant="outlined" />;
      },
    },
    {
      field: 'freshness_days',
      headerName: 'Freshness',
      width: 95,
      headerAlign: 'right',
      align: 'right',
      renderHeader: () => headerWithTip('freshness_days', 'Freshness'),
      renderCell: (params: GridRenderCellParams) => {
        const days = Number(params.value || 0);
        const color = days <= 1 ? 'success.main' : days <= 3 ? 'warning.main' : 'error.main';
        return <Typography sx={{ color }}>{`${days}d`}</Typography>;
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
        onRowSelectionModelChange={selection => onSelectionChange(selection.map(String))}
        onRowClick={(params) => onRowOpen(String(params.row?.symbol || ''))}
        pagination
        paginationMode="server"
        sortingMode="server"
        rowCount={total}
        loading={loading}
        paginationModel={{ page, pageSize }}
        columnVisibilityModel={columnVisibilityModel}
        onColumnVisibilityModelChange={model => onColumnVisibilityModelChange(model)}
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
        sx={{
          border: 'none',
          '& .MuiDataGrid-cell:focus': { outline: 'none' },
          '& .MuiDataGrid-row': {
            borderBottom: '1px solid rgba(255,255,255,0.04)',
          },
          '& .MuiDataGrid-row:nth-of-type(even)': {
            backgroundColor: 'rgba(255,255,255,0.01)',
          },
          '& .MuiDataGrid-row:hover': {
            backgroundColor: 'rgba(129, 140, 248, 0.1)',
            transition: 'background-color 0.2s ease',
          },
          '& .MuiDataGrid-columnHeaders': {
            backgroundColor: 'rgba(24,24,27,0.9)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          },
        }}
      />
    </Box>
  );
};

export default ScreenerTable;
