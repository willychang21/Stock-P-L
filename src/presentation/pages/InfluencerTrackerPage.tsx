import {
  Box,
  Typography,
  Button,
  Container,
  Grid,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { Add, Assessment } from '@mui/icons-material';
import { useState, useEffect } from 'react';
import {
  Influencer,
  Recommendation,
  InfluencerCreate,
  RecommendationCreate,
} from '@domain/models/Influencer';
import { apiClient } from '@infrastructure/api/client';
import { InfluencerList } from '../components/influencers/InfluencerList';
import { RecommendationTable } from '../components/influencers/RecommendationTable';
import { AddRecommendationDialog } from '../components/influencers/AddRecommendationDialog';
import { InfluencerStats } from '../components/influencers/InfluencerStats';

export function InfluencerTrackerPage() {
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [selectedInfluencerId, setSelectedInfluencerId] = useState<
    string | null
  >(null);
  const [isAddRecOpen, setIsAddRecOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [infs, recs] = await Promise.all([
        apiClient.getInfluencers(),
        apiClient.getRecommendations(),
      ]);
      setInfluencers(infs);
      setRecommendations(recs);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  };

  const handleAddInfluencer = async (data: InfluencerCreate) => {
    try {
      await apiClient.createInfluencer(data);
      fetchData(); // Refresh all
    } catch (error) {
      alert('Failed to create influencer');
    }
  };

  const handleDeleteInfluencer = async (id: string) => {
    if (
      !confirm(
        'Are you sure based? This will delete all their recommendations too.'
      )
    )
      return;
    try {
      await apiClient.deleteInfluencer(id);
      if (selectedInfluencerId === id) setSelectedInfluencerId(null);
      fetchData();
    } catch (error) {
      alert('Failed to delete influencer');
    }
  };

  const handleAddRecommendation = async (
    influencerId: string,
    data: RecommendationCreate[]
  ) => {
    try {
      await apiClient.createRecommendationsBatch(influencerId, data);
      fetchData();
    } catch (error) {
      alert('Failed to add recommendations');
    }
  };

  const handleDeleteRecommendation = async (id: string) => {
    if (!confirm('Remove this recommendation?')) return;
    try {
      await apiClient.deleteRecommendation(id);
      fetchData();
    } catch (error) {
      alert('Failed to delete recommendation');
    }
  };

  const filteredRecommendations = selectedInfluencerId
    ? recommendations.filter(r => r.influencer_id === selectedInfluencerId)
    : recommendations;

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Influencer Tracker
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<Assessment />}
            onClick={() => setIsStatsOpen(true)}
          >
            View Statistics
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setIsAddRecOpen(true)}
          >
            Add Recommendation
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3} sx={{ height: 'calc(100vh - 200px)' }}>
        <Grid item xs={12} md={3} sx={{ height: '100%' }}>
          <InfluencerList
            influencers={influencers}
            selectedId={selectedInfluencerId}
            onSelect={setSelectedInfluencerId}
            onAdd={handleAddInfluencer}
            onDelete={handleDeleteInfluencer}
          />
        </Grid>
        <Grid item xs={12} md={9} sx={{ height: '100%', overflow: 'auto' }}>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2,
              }}
            >
              <Typography variant="h6">
                {selectedInfluencerId
                  ? `Recommendations by ${influencers.find(i => i.id === selectedInfluencerId)?.name || 'Unknown'}`
                  : 'All Recommendations'}
              </Typography>
            </Box>
            <RecommendationTable
              recommendations={filteredRecommendations}
              influencers={influencers}
              onDelete={handleDeleteRecommendation}
            />
          </Paper>
        </Grid>
      </Grid>

      {/* Stats Dialog */}
      <Dialog
        open={isStatsOpen}
        onClose={() => setIsStatsOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Assessment /> Statistics
        </DialogTitle>
        <DialogContent dividers>
          <InfluencerStats
            recommendations={recommendations}
            influencers={influencers}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsStatsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <AddRecommendationDialog
        open={isAddRecOpen}
        onClose={() => setIsAddRecOpen(false)}
        onAdd={handleAddRecommendation}
        influencers={influencers}
        initialInfluencerId={selectedInfluencerId}
      />
    </Container>
  );
}
