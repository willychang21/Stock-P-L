import {
  Paper,
  Typography,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Box,
  Divider,
  Chip,
} from '@mui/material';
import { Star, EmojiEvents } from '@mui/icons-material';
import { Recommendation, Influencer } from '@domain/models/Influencer';

interface InfluencerStatsProps {
  recommendations: Recommendation[];
  influencers: Influencer[];
}

export function InfluencerStats({
  recommendations,
  influencers,
}: InfluencerStatsProps) {
  // 1. Calculate Influencer Performance
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
    .sort((a, b) => b.avgReturn - a.avgReturn); // Sort by return desc

  // 2. Calculate Popular Stocks
  const stockCounts: Record<
    string,
    { count: number; influencers: Set<string> }
  > = {};
  recommendations.forEach(r => {
    if (!stockCounts[r.symbol]) {
      stockCounts[r.symbol] = { count: 0, influencers: new Set() };
    }
    const entry = stockCounts[r.symbol];
    if (entry) {
      entry.count++;
      const infName = influencers.find(i => i.id === r.influencer_id)?.name;
      if (infName) entry.influencers.add(infName);
    }
  });

  const popularStocks = Object.entries(stockCounts)
    .map(([symbol, data]) => ({
      symbol,
      count: data.count,
      influencers: Array.from(data.influencers),
    }))
    .sort((a, b) => b.count - a.count); // Show all

  const formatPct = (val: number) => {
    const pct = val * 100;
    return `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`;
  };

  if (influencerStats.length === 0 && popularStocks.length === 0) return null;

  return (
    <Grid container spacing={3} sx={{ mb: 3 }}>
      {/* Performance Ranking */}
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 2, height: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
            <EmojiEvents color="warning" />
            <Typography variant="h6">Performance Ranking</Typography>
          </Box>
          <List dense>
            {influencerStats.map((stat, index) => (
              <div key={stat.id}>
                <ListItem>
                  <ListItemAvatar>
                    <Avatar
                      sx={{
                        bgcolor: index === 0 ? 'gold' : 'action.selected',
                        color: index === 0 ? 'black' : 'inherit',
                        width: 28,
                        height: 28,
                        fontSize: 14,
                      }}
                    >
                      {index + 1}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Typography variant="subtitle2">{stat.name}</Typography>
                        <Typography
                          variant="subtitle2"
                          color={
                            stat.avgReturn >= 0 ? 'success.main' : 'error.main'
                          }
                        >
                          {formatPct(stat.avgReturn)}
                        </Typography>
                      </Box>
                    }
                    secondary={`Recs: ${stat.count} | Win Rate: ${(stat.winRate * 100).toFixed(0)}%`}
                  />
                </ListItem>
                {index < influencerStats.length - 1 && (
                  <Divider variant="inset" component="li" />
                )}
              </div>
            ))}
            {influencerStats.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                Not enough data to rank performance.
              </Typography>
            )}
          </List>
        </Paper>
      </Grid>

      {/* Popular Stocks */}
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 2, height: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
            <Star color="primary" />
            <Typography variant="h6">Popular Recommendations</Typography>
          </Box>
          <List dense>
            {popularStocks.map((stock, index) => (
              <div key={stock.symbol}>
                <ListItem>
                  <ListItemText
                    primary={
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Typography variant="subtitle2">
                          {stock.symbol}
                        </Typography>
                        <Chip
                          label={`${stock.count} recs`}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                    }
                    secondary={`By: ${stock.influencers.join(', ')}`}
                    secondaryTypographyProps={{ noWrap: true }}
                  />
                </ListItem>
                {index < popularStocks.length - 1 && (
                  <Divider variant="inset" component="li" />
                )}
              </div>
            ))}
            {popularStocks.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                No recommendations yet.
              </Typography>
            )}
          </List>
        </Paper>
      </Grid>
    </Grid>
  );
}
