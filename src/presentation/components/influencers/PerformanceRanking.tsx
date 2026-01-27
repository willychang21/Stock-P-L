import {
  Paper,
  Typography,
  Avatar,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { EmojiEvents } from '@mui/icons-material';
import { Recommendation, Influencer } from '@domain/models/Influencer';
import { useTranslation } from 'react-i18next';
import { getFaviconUrl } from '@presentation/utils/favicon';

interface PerformanceRankingProps {
  recommendations: Recommendation[];
  influencers: Influencer[];
}

export function PerformanceRanking({
  recommendations,
  influencers,
}: PerformanceRankingProps) {
  const { t } = useTranslation();

  const influencerStats = influencers
    .map(inf => {
      const recs = recommendations.filter(r => r.influencer_id === inf.id);
      const withReturn = recs.filter(r => r.price_change_percent !== null);
      if (withReturn.length === 0) return null;

      const avgReturn =
        withReturn.reduce((sum, r) => sum + (r.price_change_percent || 0), 0) /
        withReturn.length;

      const winCount = withReturn.filter(
        r => (r.price_change_percent || 0) > 0
      ).length;
      const winRate = winCount / withReturn.length;

      return {
        id: inf.id,
        name: inf.name,
        avgReturn,
        winRate,
        count: recs.length,
      };
    })
    .filter((stat): stat is NonNullable<typeof stat> => stat !== null)
    .sort((a, b) => b.avgReturn - a.avgReturn);

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
        <EmojiEvents color="warning" />
        <Typography variant="h6">
          {t('influencers.performanceRanking')}
        </Typography>
      </Box>
      <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell>{t('influencers.name')}</TableCell>
              <TableCell align="right">{t('influencers.winRate')}</TableCell>
              <TableCell align="right">
                {t('influencers.table.return')}
              </TableCell>
              <TableCell align="right">{t('influencers.recsCount')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {influencerStats.map((stat, index) => {
              const inf = influencers.find(i => i.id === stat.id);
              return (
                <TableRow key={stat.id} hover>
                  <TableCell>
                    <Avatar
                      sx={{
                        bgcolor: index === 0 ? 'gold' : 'action.selected',
                        color: index === 0 ? 'black' : 'inherit',
                        width: 24,
                        height: 24,
                        fontSize: 12,
                      }}
                    >
                      {index + 1}
                    </Avatar>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar
                        src={getFaviconUrl(inf?.url)}
                        alt={inf?.name}
                        sx={{ width: 24, height: 24 }}
                      />
                      <Typography variant="body2">{stat.name}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    {(stat.winRate * 100).toFixed(0)}%
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      color={
                        stat.avgReturn >= 0 ? 'success.main' : 'error.main'
                      }
                      fontWeight="bold"
                    >
                      {formatPct(stat.avgReturn)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">{stat.count}</TableCell>
                </TableRow>
              );
            })}
            {influencerStats.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography variant="body2" color="text.secondary">
                    {t('influencers.noData')}
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
