import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  TableSortLabel,
  Stack,
  Avatar,
  Box,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  OpenInNew,
  Edit as EditIcon,
  TrendingUp,
  TrendingDown,
  TrendingFlat,
  CheckCircle,
  Cancel,
  Shield,
  Visibility,
} from '@mui/icons-material';
import {
  Recommendation,
  Influencer,
  getSignalLabel,
  getTimeframeLabel,
  getStatusLabel,
} from '@domain/models/Influencer';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getFaviconUrl } from '@presentation/utils/favicon';

interface RecommendationTableProps {
  recommendations: Recommendation[];
  influencers: Influencer[];
  onDelete?: (id: string) => void;
  onEdit?: (rec: Recommendation) => void;
  readOnly?: boolean;
}

type Order = 'asc' | 'desc';
type SortField = 'date' | 'influencer' | 'symbol' | 'return' | 'signal';

export function RecommendationTable({
  recommendations,
  influencers,
  onDelete,
  onEdit,
  readOnly = false,
}: RecommendationTableProps) {
  const [order, setOrder] = useState<Order>('desc');
  const [orderBy, setOrderBy] = useState<SortField>('date');
  const { t } = useTranslation();

  const handleRequestSort = (property: SortField) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const getInfluencerName = (id: string) => {
    return influencers.find(inf => inf.id === id)?.name || 'Unknown';
  };

  const formatCurrency = (val: number | undefined | null) => {
    if (val === undefined || val === null) return '—';
    return `$${val.toFixed(2)}`;
  };

  const formatPct = (val: number | undefined | null) => {
    if (val === undefined || val === null) return '—';
    const pct = val * 100;
    return `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`;
  };

  const getSignalIcon = (signal: string) => {
    switch (signal) {
      case 'BUY':
        return <TrendingUp fontSize="small" color="success" />;
      case 'SELL':
        return <TrendingDown fontSize="small" color="error" />;
      case 'HEDGE':
        return <Shield fontSize="small" sx={{ color: '#ff9800' }} />;
      case 'WATCH':
        return <Visibility fontSize="small" color="info" />;
      case 'CLOSED':
        return <CheckCircle fontSize="small" sx={{ color: '#9e9e9e' }} />;
      default:
        return <TrendingFlat fontSize="small" color="disabled" />;
    }
  };

  const getSignalColor = (
    signal: string
  ): 'success' | 'error' | 'warning' | 'info' | 'default' => {
    switch (signal) {
      case 'BUY':
        return 'success';
      case 'SELL':
        return 'error';
      case 'HEDGE':
        return 'warning';
      case 'WATCH':
        return 'info';
      case 'CLOSED':
        return 'default';
      default:
        return 'default';
    }
  };

  const getTimeframeColor = (
    timeframe: string
  ): 'default' | 'primary' | 'secondary' => {
    switch (timeframe) {
      case 'SHORT':
        return 'secondary';
      case 'LONG':
        return 'primary';
      default:
        return 'default';
    }
  };

  const getStatusColor = (
    status: string
  ): 'default' | 'success' | 'warning' | 'error' => {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'EXPIRED':
        return 'warning';
      case 'CLOSED_WIN':
        return 'success';
      case 'CLOSED_LOSS':
        return 'error';
      default:
        return 'default';
    }
  };

  const sortRecommendations = (recs: Recommendation[]) => {
    return [...recs].sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      switch (orderBy) {
        case 'date':
          valA = a.recommendation_date;
          valB = b.recommendation_date;
          break;
        case 'influencer':
          valA = getInfluencerName(a.influencer_id).toLowerCase();
          valB = getInfluencerName(b.influencer_id).toLowerCase();
          break;
        case 'symbol':
          valA = a.symbol;
          valB = b.symbol;
          break;
        case 'return':
          valA = a.unrealized_return || -999;
          valB = b.unrealized_return || -999;
          break;
        case 'signal':
          valA = a.signal;
          valB = b.signal;
          break;
      }

      if (valA < valB) {
        return order === 'asc' ? -1 : 1;
      }
      if (valA > valB) {
        return order === 'asc' ? 1 : -1;
      }
      return 0;
    });
  };

  if (recommendations.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">
          {t('influencers.table.empty')}
        </Typography>
      </Paper>
    );
  }

  const sortedRecs = sortRecommendations(recommendations);

  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sortDirection={orderBy === 'date' ? order : false}>
              <TableSortLabel
                active={orderBy === 'date'}
                direction={orderBy === 'date' ? order : 'asc'}
                onClick={() => handleRequestSort('date')}
              >
                日期
              </TableSortLabel>
            </TableCell>
            <TableCell sortDirection={orderBy === 'influencer' ? order : false}>
              <TableSortLabel
                active={orderBy === 'influencer'}
                direction={orderBy === 'influencer' ? order : 'asc'}
                onClick={() => handleRequestSort('influencer')}
              >
                網紅
              </TableSortLabel>
            </TableCell>
            <TableCell sortDirection={orderBy === 'symbol' ? order : false}>
              <TableSortLabel
                active={orderBy === 'symbol'}
                direction={orderBy === 'symbol' ? order : 'asc'}
                onClick={() => handleRequestSort('symbol')}
              >
                標的
              </TableSortLabel>
            </TableCell>
            <TableCell sortDirection={orderBy === 'signal' ? order : false}>
              <TableSortLabel
                active={orderBy === 'signal'}
                direction={orderBy === 'signal' ? order : 'asc'}
                onClick={() => handleRequestSort('signal')}
              >
                方向
              </TableSortLabel>
            </TableCell>
            <TableCell>期限</TableCell>
            <TableCell align="right">進場價</TableCell>
            <TableCell align="right">目標/止損</TableCell>
            <TableCell align="right">現價</TableCell>
            <TableCell
              align="right"
              sortDirection={orderBy === 'return' ? order : false}
            >
              <TableSortLabel
                active={orderBy === 'return'}
                direction={orderBy === 'return' ? order : 'asc'}
                onClick={() => handleRequestSort('return')}
              >
                報酬
              </TableSortLabel>
            </TableCell>
            <TableCell>狀態</TableCell>
            <TableCell>原文</TableCell>
            {!readOnly && <TableCell align="right">操作</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedRecs.map(rec => {
            const isPositive =
              rec.unrealized_return && rec.unrealized_return >= 0;
            const noteIsUrl = rec.note?.startsWith('http');

            return (
              <TableRow key={rec.id} hover>
                <TableCell>
                  <Typography variant="body2" noWrap>
                    {rec.recommendation_date}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    avatar={
                      <Avatar
                        src={getFaviconUrl(
                          influencers.find(i => i.id === rec.influencer_id)?.url
                        )}
                        alt={getInfluencerName(rec.influencer_id)}
                      />
                    }
                    label={getInfluencerName(rec.influencer_id)}
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  <Typography fontWeight="bold">{rec.symbol}</Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    icon={getSignalIcon(rec.signal)}
                    label={getSignalLabel(rec.signal)}
                    size="small"
                    color={getSignalColor(rec.signal)}
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={getTimeframeLabel(rec.timeframe)}
                    size="small"
                    color={getTimeframeColor(rec.timeframe)}
                    variant="outlined"
                  />
                </TableCell>
                <TableCell align="right">
                  {formatCurrency(rec.entry_price)}
                </TableCell>
                <TableCell align="right">
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                    }}
                  >
                    {rec.target_price && (
                      <Tooltip title="目標價">
                        <Typography variant="caption" color="success.main">
                          🎯 {formatCurrency(rec.target_price)}
                        </Typography>
                      </Tooltip>
                    )}
                    {rec.stop_loss && (
                      <Tooltip title="止損價">
                        <Typography variant="caption" color="error.main">
                          🛑 {formatCurrency(rec.stop_loss)}
                        </Typography>
                      </Tooltip>
                    )}
                    {!rec.target_price && !rec.stop_loss && '—'}
                  </Box>
                </TableCell>
                <TableCell align="right">
                  {formatCurrency(rec.current_price)}
                </TableCell>
                <TableCell align="right">
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: 0.5,
                    }}
                  >
                    {rec.hit_target && (
                      <Tooltip title="達標">
                        <CheckCircle fontSize="small" color="success" />
                      </Tooltip>
                    )}
                    {rec.hit_stop_loss && (
                      <Tooltip title="觸止損">
                        <Cancel fontSize="small" color="error" />
                      </Tooltip>
                    )}
                    <Typography
                      variant="body2"
                      color={isPositive ? 'success.main' : 'error.main'}
                      fontWeight="bold"
                    >
                      {formatPct(rec.unrealized_return)}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip
                    label={getStatusLabel(rec.status)}
                    size="small"
                    color={getStatusColor(rec.status)}
                    variant="filled"
                  />
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0} alignItems="center">
                    {rec.source_url && (
                      <Tooltip title="開啟原文連結">
                        <IconButton
                          size="small"
                          href={rec.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        >
                          <OpenInNew fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {rec.note && !rec.note.startsWith('http') && (
                      <Tooltip
                        title={
                          <Typography
                            variant="body2"
                            sx={{ whiteSpace: 'pre-wrap', maxWidth: 400 }}
                          >
                            {rec.note}
                          </Typography>
                        }
                        arrow
                      >
                        <Chip
                          label="📝"
                          size="small"
                          variant="outlined"
                          sx={{ cursor: 'pointer' }}
                        />
                      </Tooltip>
                    )}
                    {!rec.source_url && !rec.note && '—'}
                  </Stack>
                </TableCell>
                {!readOnly && (
                  <TableCell align="right">
                    <Stack
                      direction="row"
                      justifyContent="flex-end"
                      spacing={0}
                    >
                      {rec.note &&
                        (noteIsUrl ? (
                          <Tooltip title="查看連結">
                            <IconButton
                              size="small"
                              href={rec.note}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <OpenInNew fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Tooltip title={rec.note}>
                            <IconButton size="small" disabled>
                              <OpenInNew fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ))}
                      {onEdit && (
                        <IconButton size="small" onClick={() => onEdit(rec)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      )}
                      {onDelete && (
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => onDelete(rec.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Stack>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
