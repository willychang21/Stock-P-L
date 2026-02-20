import {
  Paper,
  Typography,
  Avatar,
  Box,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { Star } from '@mui/icons-material';
import { Recommendation, Influencer } from '@domain/models/Influencer';
import { useTranslation } from 'react-i18next';
import { getFaviconUrl } from '@presentation/utils/favicon';

interface PopularStocksProps {
  recommendations: Recommendation[];
  influencers: Influencer[];
}

export function PopularStocks({
  recommendations,
  influencers,
}: PopularStocksProps) {
  const { t } = useTranslation();

  const stockCounts: Record<
    string,
    { count: number; influencerIds: Set<string> }
  > = {};
  recommendations.forEach(r => {
    if (!stockCounts[r.symbol]) {
      stockCounts[r.symbol] = { count: 0, influencerIds: new Set() };
    }
    const entry = stockCounts[r.symbol];
    if (entry) {
      entry.count++;
      if (r.influencer_id) entry.influencerIds.add(r.influencer_id);
    }
  });

  const popularStocks = Object.entries(stockCounts)
    .map(([symbol, data]) => {
      const recs = recommendations.filter(
        r =>
          r.symbol === symbol &&
          r.unrealized_return !== undefined &&
          r.unrealized_return !== null
      );
      const avgReturn =
        recs.length > 0
          ? recs.reduce((sum, r) => sum + (r.unrealized_return || 0), 0) /
            recs.length
          : 0;

      return {
        symbol,
        count: data.count,
        influencerIds: Array.from(data.influencerIds),
        avgReturn,
        hasReturn: recs.length > 0,
      };
    })
    .sort((a, b) => b.count - a.count);

  const formatPct = (val: number) => {
    const pct = val * 100;
    return `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`;
  };

  return (
    <Paper
      sx={{
        p: 2,
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
        <Star color="primary" />
        <Typography variant="h6">
          {t('influencers.popularRecommendations')}
        </Typography>
      </Box>
      <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('influencers.table.symbol')}</TableCell>
              <TableCell align="right">{t('influencers.recsCount')}</TableCell>
              <TableCell align="right">
                {t('influencers.table.avgReturn')}
              </TableCell>
              <TableCell>{t('influencers.table.influencer')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {popularStocks.map(stock => (
              <TableRow key={stock.symbol} hover>
                <TableCell sx={{ fontWeight: 'bold' }}>
                  {stock.symbol}
                </TableCell>
                <TableCell align="right">{stock.count}</TableCell>
                <TableCell align="right">
                  {stock.hasReturn ? (
                    <Typography
                      variant="body2"
                      color={
                        stock.avgReturn >= 0 ? 'success.main' : 'error.main'
                      }
                      fontWeight="bold"
                    >
                      {formatPct(stock.avgReturn)}
                    </Typography>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {stock.influencerIds.map(id => {
                      const inf = influencers.find(i => i.id === id);
                      return (
                        <Chip
                          key={id}
                          avatar={
                            <Avatar
                              src={getFaviconUrl(inf?.url)}
                              alt={inf?.name}
                            />
                          }
                          label={inf?.name}
                          size="small"
                          variant="outlined"
                        />
                      );
                    })}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
            {popularStocks.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} align="center">
                  <Typography variant="body2" color="text.secondary">
                    {t('influencers.noRecs')}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
