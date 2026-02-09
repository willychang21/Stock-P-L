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
  Link,
  Tooltip,
  TableSortLabel,
  Stack,
  Avatar,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  OpenInNew,
  Edit as EditIcon,
} from '@mui/icons-material';
import { Recommendation, Influencer } from '@domain/models/Influencer';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getFaviconUrl } from '@presentation/utils/favicon';

interface RecommendationTableProps {
  recommendations: Recommendation[];
  influencers: Influencer[];
  onDelete: (id: string) => void;
  onEdit: (rec: Recommendation) => void;
}

type Order = 'asc' | 'desc';
type SortField = 'date' | 'influencer' | 'symbol' | 'return';

export function RecommendationTable({
  recommendations,
  influencers,
  onDelete,
  onEdit,
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
          valA = a.price_change_percent || -999;
          valB = b.price_change_percent || -999;
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
      <Table>
        <TableHead>
          <TableRow>
            <TableCell sortDirection={orderBy === 'date' ? order : false}>
              <TableSortLabel
                active={orderBy === 'date'}
                direction={orderBy === 'date' ? order : 'asc'}
                onClick={() => handleRequestSort('date')}
              >
                {t('influencers.table.date')}
              </TableSortLabel>
            </TableCell>
            <TableCell sortDirection={orderBy === 'influencer' ? order : false}>
              <TableSortLabel
                active={orderBy === 'influencer'}
                direction={orderBy === 'influencer' ? order : 'asc'}
                onClick={() => handleRequestSort('influencer')}
              >
                {t('influencers.table.influencer')}
              </TableSortLabel>
            </TableCell>
            <TableCell sortDirection={orderBy === 'symbol' ? order : false}>
              <TableSortLabel
                active={orderBy === 'symbol'}
                direction={orderBy === 'symbol' ? order : 'asc'}
                onClick={() => handleRequestSort('symbol')}
              >
                {t('influencers.table.symbol')}
              </TableSortLabel>
            </TableCell>
            <TableCell align="right">
              {t('influencers.table.initialPrice')}
            </TableCell>
            <TableCell align="right">
              {t('influencers.table.currentPrice')}
            </TableCell>
            <TableCell
              align="right"
              sortDirection={orderBy === 'return' ? order : false}
            >
              <TableSortLabel
                active={orderBy === 'return'}
                direction={orderBy === 'return' ? order : 'asc'}
                onClick={() => handleRequestSort('return')}
              >
                {t('influencers.table.return')}
              </TableSortLabel>
            </TableCell>
            <TableCell>{t('influencers.table.note')}</TableCell>
            <TableCell align="right">
              {t('influencers.table.actions')}
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedRecs.map(rec => {
            const isPositive =
              rec.price_change_percent && rec.price_change_percent >= 0;
            const noteIsUrl = rec.note?.startsWith('http');

            return (
              <TableRow key={rec.id} hover>
                <TableCell>{rec.recommendation_date}</TableCell>
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
                    onClick={() => {
                      // Optional: Filter by influencer
                    }}
                  />
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>{rec.symbol}</TableCell>
                <TableCell align="right">
                  {formatCurrency(rec.initial_price)}
                </TableCell>
                <TableCell align="right">
                  {formatCurrency(rec.current_price)}
                </TableCell>
                <TableCell align="right">
                  <Typography
                    variant="body2"
                    color={isPositive ? 'success.main' : 'error.main'}
                    fontWeight="bold"
                  >
                    {formatPct(rec.price_change_percent)}
                  </Typography>
                </TableCell>
                <TableCell sx={{ maxWidth: 200 }}>
                  {rec.note ? (
                    noteIsUrl ? (
                      <Link
                        href={rec.note}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                      >
                        Link <OpenInNew fontSize="small" />
                      </Link>
                    ) : (
                      <Tooltip title={rec.note}>
                        <Typography noWrap variant="body2">
                          {rec.note}
                        </Typography>
                      </Tooltip>
                    )
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" justifyContent="flex-end" spacing={1}>
                    <IconButton size="small" onClick={() => onEdit(rec)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => onDelete(rec.id)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
