import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Add from '@mui/icons-material/Add';
import AutoMode from '@mui/icons-material/AutoMode';
import Edit from '@mui/icons-material/Edit';
import TrendingUp from '@mui/icons-material/TrendingUp';
import { useState, useEffect, useMemo } from 'react';
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
import { PendingReviewList } from '../components/influencers/PendingReviewList';
import { ScrapedPostsHistory } from '../components/influencers/ScrapedPostsHistory';
import { useTranslation } from 'react-i18next';

// Top-level mode tabs
type TrackingMode = 'manual' | 'auto';

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

  // Top-level mode: 'manual' or 'auto'
  const [trackingMode, setTrackingMode] = useState<TrackingMode>('manual');
  // Sub-tabs within each mode
  const [manualSubTab, setManualSubTab] = useState(0);
  const [autoSubTab, setAutoSubTab] = useState(0);
  const [isAutoTracking, setIsAutoTracking] = useState(false);

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

  // Split recommendations by source type
  // Legacy data might have URLs in the source field, or null
  const manualRecommendations = useMemo(
    () =>
      recommendations.filter(
        r =>
          !r.source ||
          r.source === 'MANUAL' ||
          (!r.source.startsWith('http') && !r.source.startsWith('AUTO_'))
      ),
    [recommendations]
  );

  const autoRecommendations = useMemo(
    () =>
      recommendations.filter(
        r =>
          r.source &&
          (r.source.startsWith('http') || r.source.startsWith('AUTO_'))
      ),
    [recommendations]
  );

  // Filter by selected influencer
  const filteredManualRecs = useMemo(
    () =>
      selectedInfluencerId
        ? manualRecommendations.filter(
            r => r.influencer_id === selectedInfluencerId
          )
        : manualRecommendations,
    [manualRecommendations, selectedInfluencerId]
  );

  const filteredAutoRecs = useMemo(
    () =>
      selectedInfluencerId
        ? autoRecommendations.filter(
            r => r.influencer_id === selectedInfluencerId
          )
        : autoRecommendations,
    [autoRecommendations, selectedInfluencerId]
  );

  const handleAddInfluencer = async (data: InfluencerCreate) => {
    try {
      await apiClient.createInfluencer(data);
      fetchData();
    } catch (error) {
      alert(t('influencers.alerts.createFailed'));
    }
  };

  const handleUpdateInfluencer = async (id: string, data: InfluencerUpdate) => {
    try {
      await apiClient.updateInfluencer(id, data);
      fetchData();
    } catch (error) {
      alert(t('influencers.alerts.updateFailed'));
    }
  };

  const handleDeleteInfluencer = async (id: string) => {
    if (!confirm(t('influencers.deleteConfirm'))) return;
    try {
      await apiClient.deleteInfluencer(id);
      if (selectedInfluencerId === id) setSelectedInfluencerId(null);
      fetchData();
    } catch (error) {
      alert(t('influencers.alerts.deleteFailed'));
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
      alert(t('influencers.alerts.addRecsFailed'));
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
      alert(t('influencers.alerts.updateRecFailed'));
    }
  };

  const handleDeleteRecommendation = async (id: string) => {
    if (!confirm(t('influencers.deleteRecConfirm'))) return;
    try {
      await apiClient.deleteRecommendation(id);
      fetchData();
    } catch (error) {
      alert(t('influencers.alerts.deleteRecFailed'));
    }
  };

  const handleAutoTrack = async (limit: number = 5) => {
    if (!selectedInfluencerId) {
      alert(t('influencers.alerts.selectInfluencerFirst'));
      return;
    }

    const inf = influencers.find(i => i.id === selectedInfluencerId);
    if (!inf?.url) {
      alert(t('influencers.alerts.influencerNoUrl'));
      return;
    }

    setIsAutoTracking(true);
    try {
      const result = await apiClient.triggerAutoTrack(
        selectedInfluencerId,
        inf.platform || 'threads',
        limit
      );
      alert(
        t('influencers.alerts.autoTrackSuccess', {
          posts: result.posts_analyzed,
          recs: result.recommendations_found,
        })
      );
      setAutoSubTab(0);
    } catch (error: any) {
      console.error('Auto-track failed:', error);
      alert(t('influencers.alerts.autoTrackFailed', { error: error.message }));
    } finally {
      setIsAutoTracking(false);
    }
  };

  const handleAutoTrackAll = async (limit: number = 5) => {
    setIsAutoTracking(true);
    try {
      const result = await apiClient.triggerAutoTrackAll(limit);
      const msg =
        t('influencers.alerts.autoTrackAllSuccess', {
          influencers: result.total_influencers,
          posts: result.total_posts_scraped,
          recs: result.total_recommendations,
        }) +
        (result.auto_approved > 0
          ? t('influencers.alerts.autoTrackAllAutoApproved', {
              approved: result.auto_approved,
            })
          : '') +
        (result.errors.length > 0
          ? t('influencers.alerts.autoTrackAllErrors', {
              errors: result.errors.join('\n'),
            })
          : '');
      alert(msg);
      setAutoSubTab(0);
      fetchData();
    } catch (error: any) {
      console.error('Auto-track-all failed:', error);
      alert(
        t('influencers.alerts.autoTrackAllFailed', { error: error.message })
      );
    } finally {
      setIsAutoTracking(false);
    }
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Top-level mode tabs */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h4" component="h1">
            {t('influencers.title')}
          </Typography>
          <Tabs
            value={trackingMode}
            onChange={(_, v) => setTrackingMode(v)}
            sx={{ ml: 3 }}
          >
            <Tab
              value="manual"
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Edit fontSize="small" />
                  {t('influencers.modes.manual')}
                  <Chip size="small" label={manualRecommendations.length} />
                </Box>
              }
            />
            <Tab
              value="auto"
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AutoMode fontSize="small" />
                  {t('influencers.modes.auto')}
                  <Chip
                    size="small"
                    label={autoRecommendations.length}
                    color="secondary"
                  />
                </Box>
              }
            />
          </Tabs>
        </Box>

        {trackingMode === 'manual' && (
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setIsAddRecOpen(true)}
          >
            {t('influencers.addRecommendation')}
          </Button>
        )}

        {trackingMode === 'auto' && (
          <Button
            variant="contained"
            color="secondary"
            startIcon={
              isAutoTracking ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                <AutoMode />
              )
            }
            onClick={() => handleAutoTrackAll(5)}
            disabled={isAutoTracking}
          >
            {isAutoTracking
              ? t('influencers.modes.trackingStatus')
              : t('influencers.modes.trackAll')}
          </Button>
        )}
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
            {/* === MANUAL MODE === */}
            {trackingMode === 'manual' && (
              <>
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
                    value={manualSubTab}
                    onChange={(_, v) => setManualSubTab(v)}
                  >
                    <Tab label={t('influencers.tabs.recommendationList')} />
                    <Tab
                      label={t('influencers.tabs.performance')}
                      icon={<TrendingUp fontSize="small" />}
                      iconPosition="end"
                    />
                    <Tab label={t('influencers.tabs.popular')} />
                  </Tabs>
                  {manualSubTab === 0 && (
                    <Typography variant="subtitle1" color="text.secondary">
                      {selectedInfluencerId
                        ? t('influencers.stats.influencerCount', {
                            name:
                              influencers.find(
                                i => i.id === selectedInfluencerId
                              )?.name || t('influencers.stats.unknown'),
                            count: filteredManualRecs.length,
                          })
                        : t('influencers.stats.allManual', {
                            count: filteredManualRecs.length,
                          })}
                    </Typography>
                  )}
                </Box>

                <Box sx={{ flex: 1, overflow: 'auto' }}>
                  {manualSubTab === 0 && (
                    <RecommendationTable
                      recommendations={filteredManualRecs}
                      influencers={influencers}
                      onDelete={handleDeleteRecommendation}
                      onEdit={handleEditRecommendation}
                    />
                  )}
                  {manualSubTab === 1 && (
                    <PerformanceRanking
                      recommendations={manualRecommendations}
                      influencers={influencers}
                    />
                  )}
                  {manualSubTab === 2 && (
                    <PopularStocks
                      recommendations={manualRecommendations}
                      influencers={influencers}
                    />
                  )}
                </Box>
              </>
            )}

            {/* === AUTO TRACKING MODE === */}
            {trackingMode === 'auto' && (
              <>
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
                    value={autoSubTab}
                    onChange={(_, v) => setAutoSubTab(v)}
                  >
                    <Tab label={t('influencers.tabs.pendingReview')} />
                    <Tab label={t('influencers.tabs.confirmedRecs')} />
                    <Tab
                      label={t('influencers.tabs.performance')}
                      icon={<TrendingUp fontSize="small" />}
                      iconPosition="end"
                    />
                    <Tab label={t('influencers.tabs.analysisHistory')} />
                  </Tabs>
                  {autoSubTab === 1 && (
                    <Typography variant="subtitle1" color="text.secondary">
                      {selectedInfluencerId
                        ? t('influencers.stats.influencerCount', {
                            name:
                              influencers.find(
                                i => i.id === selectedInfluencerId
                              )?.name || t('influencers.stats.unknown'),
                            count: filteredAutoRecs.length,
                          })
                        : t('influencers.stats.allAuto', {
                            count: filteredAutoRecs.length,
                          })}
                    </Typography>
                  )}
                </Box>

                <Box sx={{ flex: 1, overflow: 'auto' }}>
                  {autoSubTab === 0 && (
                    <PendingReviewList
                      influencers={influencers}
                      onReviewComplete={fetchData}
                      onTriggerAutoTrack={handleAutoTrack}
                      isAutoTracking={isAutoTracking}
                      selectedInfluencerId={selectedInfluencerId}
                    />
                  )}
                  {autoSubTab === 1 && (
                    <RecommendationTable
                      recommendations={filteredAutoRecs}
                      influencers={influencers}
                      readOnly={true}
                    />
                  )}
                  {autoSubTab === 2 && (
                    <PerformanceRanking
                      recommendations={autoRecommendations}
                      influencers={influencers}
                    />
                  )}
                  {autoSubTab === 3 && (
                    <ScrapedPostsHistory
                      selectedInfluencerId={selectedInfluencerId}
                    />
                  )}
                </Box>
              </>
            )}
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
