import {
  Box,
  Typography,
  Button,
  Container,
  Grid,
  Paper,
  Tabs,
  Tab,
} from '@mui/material';
import { Add } from '@mui/icons-material';
import { useState, useEffect } from 'react';
import {
  Influencer,
  Recommendation,
  InfluencerCreate,
  InfluencerUpdate,
  RecommendationCreate,
  RecommendationUpdate,
} from '@domain/models/Influencer';
import { apiClient } from '@infrastructure/api/client';
import { InfluencerList } from '../components/influencers/InfluencerList';
import { RecommendationTable } from '../components/influencers/RecommendationTable';
import { AddRecommendationDialog } from '../components/influencers/AddRecommendationDialog';
import { EditRecommendationDialog } from '../components/influencers/EditRecommendationDialog';
import { PerformanceRanking } from '../components/influencers/PerformanceRanking';
import { PopularStocks } from '../components/influencers/PopularStocks';
import { useTranslation } from 'react-i18next';

export function InfluencerTrackerPage() {
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [selectedInfluencerId, setSelectedInfluencerId] = useState<
    string | null
  >(null);
  const [isAddRecOpen, setIsAddRecOpen] = useState(false);
  const [isEditRecOpen, setIsEditRecOpen] = useState(false);
  const [editingRecommendation, setEditingRecommendation] =
    useState<Recommendation | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const { t } = useTranslation();

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

  const handleUpdateInfluencer = async (id: string, data: InfluencerUpdate) => {
    try {
      await apiClient.updateInfluencer(id, data);
      fetchData();
    } catch (error) {
      alert('Failed to update influencer');
    }
  };

  const handleDeleteInfluencer = async (id: string) => {
    if (!confirm(t('influencers.deleteConfirm'))) return;
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

  const handleEditRecommendation = (rec: Recommendation) => {
    setEditingRecommendation(rec);
    setIsEditRecOpen(true);
  };

  const handleUpdateRecommendation = async (
    id: string,
    data: RecommendationUpdate
  ) => {
    try {
      await apiClient.updateRecommendation(id, data);
      fetchData();
    } catch (error) {
      alert('Failed to update recommendation');
    }
  };

  const handleDeleteRecommendation = async (id: string) => {
    if (!confirm(t('influencers.deleteRecConfirm'))) return;
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
          {t('influencers.title')}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setIsAddRecOpen(true)}
          >
            {t('influencers.addRecommendation')}
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
            onUpdate={handleUpdateInfluencer}
            onDelete={handleDeleteInfluencer}
          />
        </Grid>
        <Grid item xs={12} md={9} sx={{ height: '100%', overflow: 'hidden' }}>
          <Paper
            sx={{
              p: 2,
              mb: 2,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                borderBottom: 1,
                borderColor: 'divider',
                mb: 2,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Tabs
                value={activeTab}
                onChange={(_, newValue) => setActiveTab(newValue)}
              >
                <Tab label={t('influencers.tabs.latest')} />
                <Tab label={t('influencers.tabs.performance')} />
                <Tab label={t('influencers.tabs.popular')} />
              </Tabs>
              {activeTab === 0 && (
                <Typography variant="subtitle1" color="text.secondary">
                  {selectedInfluencerId
                    ? `${influencers.find(i => i.id === selectedInfluencerId)?.name || 'Unknown'} (${filteredRecommendations.length} ${t('influencers.recsCount')})`
                    : t('influencers.allInfluencers')}
                </Typography>
              )}
            </Box>

            <Box sx={{ flex: 1, overflow: 'auto' }}>
              {activeTab === 0 && (
                <RecommendationTable
                  recommendations={filteredRecommendations}
                  influencers={influencers}
                  onDelete={handleDeleteRecommendation}
                  onEdit={handleEditRecommendation}
                />
              )}
              {activeTab === 1 && (
                <PerformanceRanking
                  recommendations={recommendations}
                  influencers={influencers}
                />
              )}
              {activeTab === 2 && (
                <PopularStocks
                  recommendations={recommendations}
                  influencers={influencers}
                />
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      <AddRecommendationDialog
        open={isAddRecOpen}
        onClose={() => setIsAddRecOpen(false)}
        onAdd={handleAddRecommendation}
        influencers={influencers}
        initialInfluencerId={selectedInfluencerId}
      />

      <EditRecommendationDialog
        open={isEditRecOpen}
        onClose={() => setIsEditRecOpen(false)}
        onUpdate={handleUpdateRecommendation}
        recommendation={editingRecommendation}
        influencers={influencers}
      />
    </Container>
  );
}
