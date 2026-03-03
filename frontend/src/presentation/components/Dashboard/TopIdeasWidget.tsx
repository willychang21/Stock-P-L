import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Skeleton,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Refresh as RefreshIcon,
  Launch as LaunchIcon,
} from '@mui/icons-material';
import { apiClient } from '../../../infrastructure/api/client';
import { useNavigate } from 'react-router-dom';

export const TopIdeasWidget: React.FC = () => {
  const [ideas, setIdeas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchIdeas = async () => {
    setLoading(true);
    try {
      const response = await apiClient.getTopIdeas(5);
      setIdeas(response.items || []);
    } catch (error) {
      console.error('Failed to fetch top ideas:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIdeas();
  }, []);

  const formatPercent = (val: number) => {
    if (val === null || val === undefined) return '-';
    return `${(val * 100).toFixed(1)}%`;
  };

  return (
    <Card sx={{ height: '100%', borderRadius: '16px', overflow: 'hidden' }}>
      <CardContent sx={{ p: 0 }}>
        <Box
          sx={{
            p: 2,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(129, 140, 248, 0.05)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrendingUpIcon color="secondary" />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Alpha Screener: Top Ideas
            </Typography>
          </Box>
          <Box>
            <Tooltip title="Refresh">
              <IconButton size="small" onClick={fetchIdeas} disabled={loading}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Go to Screener">
              <IconButton size="small" onClick={() => navigate('/screener')}>
                <LaunchIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Symbol</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Sector</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>ROIC</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Upside</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>P/E</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton width={40} /></TableCell>
                      <TableCell><Skeleton width={80} /></TableCell>
                      <TableCell align="right"><Skeleton width={30} /></TableCell>
                      <TableCell align="right"><Skeleton width={30} /></TableCell>
                      <TableCell align="right"><Skeleton width={30} /></TableCell>
                    </TableRow>
                  ))
                : ideas.map((idea) => (
                    <TableRow key={idea.symbol} hover sx={{ cursor: 'pointer' }} onClick={() => navigate('/screener')}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                          {idea.symbol}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="textSecondary">
                          {idea.sector}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          label={formatPercent(idea.roic)}
                          size="small"
                          color={idea.roic > 0.2 ? 'success' : 'default'}
                          variant="outlined"
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color={idea.target_upside > 0 ? 'secondary.main' : 'error.main'}>
                          {formatPercent(idea.target_upside)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {idea.trailing_pe?.toFixed(1) || '-'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </TableContainer>
        {ideas.length === 0 && !loading && (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="textSecondary">
              No top ideas found. Try syncing the screener database.
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};
