/**
 * PendingReviewList - Displays AI-analyzed posts pending user review
 * Supports batch operations: Approve All, Auto-Approve, grouped multi-asset display
 */

import {
  Box,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Chip,
  Stack,
  CircularProgress,
  Avatar,
  Tooltip,
  IconButton,
  Slider,
  FormControl,
  FormLabel,
  Divider,
  Alert,
} from '@mui/material';
import {
  Check,
  Close,
  TrendingUp,
  TrendingDown,
  ExpandMore,
  ExpandLess,
  OpenInNew,
  AutoMode,
  DoneAll,
  AutoAwesome,
  PlayArrow,
  Shield,
  Visibility,
  CheckCircle,
  TrendingFlat,
} from '@mui/icons-material';
import { useState, useEffect, useMemo } from 'react';
import { apiClient } from '@infrastructure/api/client';
import { PendingReview, getSignalLabel } from '@domain/models/Influencer';
import { getFaviconUrl } from '@presentation/utils/favicon';

interface PendingReviewListProps {
  influencers: { id: string; name: string; url?: string }[];
  onReviewComplete: () => void;
  onTriggerAutoTrack: (limit: number) => Promise<void>;
  isAutoTracking: boolean;
  selectedInfluencerId: string | null;
}

export function PendingReviewList({
  influencers,
  onReviewComplete,
  onTriggerAutoTrack,
  isAutoTracking,
  selectedInfluencerId,
}: PendingReviewListProps) {
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [postLimit, setPostLimit] = useState<number>(5);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchResult, setBatchResult] = useState<string | null>(null);

  const fetchPendingReviews = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getPendingReviews();
      setPendingReviews(data);
    } catch (error) {
      console.error('Failed to fetch pending reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (review: PendingReview) => {
    setProcessing(review.id);
    try {
      await apiClient.approvePendingReview(review.id, {
        symbol: review.suggested_symbol,
        signal: review.suggested_signal,
        timeframe: review.suggested_timeframe,
      });
      setPendingReviews(prev => prev.filter(r => r.id !== review.id));
      onReviewComplete();
    } catch (error) {
      console.error('Failed to approve review:', error);
      alert('Failed to approve review');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (review: PendingReview) => {
    setProcessing(review.id);
    try {
      await apiClient.rejectPendingReview(review.id);
      setPendingReviews(prev => prev.filter(r => r.id !== review.id));
    } catch (error) {
      console.error('Failed to reject review:', error);
    } finally {
      setProcessing(null);
    }
  };

  const handleApproveAll = async () => {
    setBatchProcessing(true);
    setBatchResult(null);
    try {
      const result = await apiClient.approveAllPending();
      setBatchResult(`✅ 已通過 ${result.approved} 筆推薦`);
      setPendingReviews([]);
      onReviewComplete();
    } catch (error: any) {
      setBatchResult(`❌ 失敗: ${error.message}`);
    } finally {
      setBatchProcessing(false);
    }
  };

  const handleAutoApprove = async () => {
    setBatchProcessing(true);
    setBatchResult(null);
    try {
      const result = await apiClient.autoApprovePending(0.7);
      setBatchResult(
        `✅ 自動通過 ${result.approved} 筆（信心度≥70%），剩餘 ${result.skipped} 筆待審核`
      );
      fetchPendingReviews();
      onReviewComplete();
    } catch (error: any) {
      setBatchResult(`❌ 失敗: ${error.message}`);
    } finally {
      setBatchProcessing(false);
    }
  };

  const handleApproveGroup = async (reviews: PendingReview[]) => {
    setBatchProcessing(true);
    try {
      for (const review of reviews) {
        await apiClient.approvePendingReview(review.id, {
          symbol: review.suggested_symbol,
          signal: review.suggested_signal,
          timeframe: review.suggested_timeframe,
        });
      }
      const ids = new Set(reviews.map(r => r.id));
      setPendingReviews(prev => prev.filter(r => !ids.has(r.id)));
      onReviewComplete();
    } catch (error: any) {
      alert(`批次通過失敗: ${error.message}`);
    } finally {
      setBatchProcessing(false);
    }
  };

  const getInfluencerInfo = (id: string) => influencers.find(i => i.id === id);

  useEffect(() => {
    fetchPendingReviews();
  }, []);

  // Group reviews by source content (same post → multiple assets)
  const groupedReviews = useMemo(() => {
    const groups: {
      key: string;
      content: string;
      sourceUrl: string;
      influencerName: string;
      influencerId: string;
      reviews: PendingReview[];
    }[] = [];

    const contentMap = new Map<string, number>();

    for (const review of pendingReviews) {
      const key = review.original_content?.slice(0, 100) || review.id;
      const existingIdx = contentMap.get(key);
      if (existingIdx !== undefined && groups[existingIdx]) {
        groups[existingIdx].reviews.push(review);
      } else {
        contentMap.set(key, groups.length);
        groups.push({
          key,
          content: review.original_content,
          sourceUrl: review.source_url,
          influencerName: review.influencer_name,
          influencerId: review.influencer_id,
          reviews: [review],
        });
      }
    }

    return groups;
  }, [pendingReviews]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (pendingReviews.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
        <AutoMode sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
        <Typography variant="h6" gutterBottom>
          目前沒有待審核的推薦
        </Typography>

        {selectedInfluencerId ? (
          <Box
            sx={{
              maxWidth: 400,
              mx: 'auto',
              mt: 4,
              p: 3,
              border: 1,
              borderColor: 'divider',
              borderRadius: 2,
            }}
          >
            <Typography
              variant="subtitle1"
              gutterBottom
              sx={{ color: 'text.primary', fontWeight: 'bold' }}
            >
              開始新一輪分析
            </Typography>

            <FormControl fullWidth sx={{ mt: 2, mb: 3 }}>
              <FormLabel id="post-limit-slider" sx={{ mb: 1 }}>
                分析貼文數量: {postLimit} 篇
              </FormLabel>
              <Slider
                value={postLimit}
                onChange={(_, v) => setPostLimit(v as number)}
                min={1}
                max={20}
                step={1}
                marks={[
                  { value: 1, label: '1' },
                  { value: 5, label: '5' },
                  { value: 10, label: '10' },
                  { value: 20, label: '20' },
                ]}
                valueLabelDisplay="auto"
              />
            </FormControl>

            <Button
              variant="contained"
              color="secondary"
              size="large"
              fullWidth
              onClick={() => onTriggerAutoTrack(postLimit)}
              disabled={isAutoTracking}
              startIcon={
                isAutoTracking ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  <PlayArrow />
                )
              }
            >
              {isAutoTracking ? '正在分析中...' : '追蹤選定博主'}
            </Button>
            <Typography variant="caption" display="block" sx={{ mt: 1 }}>
              系統將爬取並分析最新的 {postLimit} 篇貼文
            </Typography>
          </Box>
        ) : (
          <Typography variant="body1" sx={{ mt: 2 }}>
            請從左側列表選擇一位網紅以開始追蹤
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      {/* Batch Action Bar */}
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          alignItems: 'center',
          flexWrap: 'wrap',
          p: 2,
          bgcolor: 'action.hover',
          borderRadius: 2,
        }}
      >
        <Typography variant="subtitle2" sx={{ mr: 1 }}>
          {pendingReviews.length} 筆待審核
        </Typography>
        <Button
          variant="contained"
          color="success"
          size="small"
          startIcon={
            batchProcessing ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <DoneAll />
            )
          }
          onClick={handleApproveAll}
          disabled={batchProcessing}
        >
          全部通過
        </Button>
        <Button
          variant="outlined"
          color="secondary"
          size="small"
          startIcon={
            batchProcessing ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <AutoAwesome />
            )
          }
          onClick={handleAutoApprove}
          disabled={batchProcessing}
        >
          自動審核（≥70%）
        </Button>
      </Box>

      {batchResult && (
        <Alert
          severity={batchResult.startsWith('✅') ? 'success' : 'error'}
          onClose={() => setBatchResult(null)}
        >
          {batchResult}
        </Alert>
      )}

      {/* Grouped Reviews */}
      {groupedReviews.map(group => {
        const influencer = getInfluencerInfo(group.influencerId);
        const isMultiAsset = group.reviews.length > 1;

        return (
          <Card key={group.key} variant="outlined">
            <CardContent sx={{ pb: 1 }}>
              {/* Header */}
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  mb: 1,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Avatar
                    src={getFaviconUrl(influencer?.url)}
                    sx={{ width: 24, height: 24 }}
                  />
                  <Typography variant="subtitle2">
                    {group.influencerName}
                  </Typography>
                  {isMultiAsset && (
                    <Chip
                      size="small"
                      label={`${group.reviews.length} 檔標的`}
                      color="info"
                      variant="outlined"
                    />
                  )}
                </Box>
                {group.sourceUrl && (
                  <Tooltip title="查看原文">
                    <IconButton
                      size="small"
                      href={group.sourceUrl}
                      target="_blank"
                    >
                      <OpenInNew fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>

              {/* Original Content Preview */}
              <Typography
                variant="body2"
                sx={{
                  p: 1,
                  bgcolor: 'action.hover',
                  borderRadius: 1,
                  fontSize: '0.8rem',
                  maxHeight: expandedId === group.key ? 'none' : 60,
                  overflow: 'hidden',
                  mb: 1,
                }}
              >
                {group.content}
              </Typography>

              {group.content?.length > 100 && (
                <Button
                  size="small"
                  onClick={() =>
                    setExpandedId(expandedId === group.key ? null : group.key)
                  }
                  endIcon={
                    expandedId === group.key ? <ExpandLess /> : <ExpandMore />
                  }
                  sx={{ mb: 1 }}
                >
                  {expandedId === group.key ? '收起' : '展開'}
                </Button>
              )}

              {/* Assets from this post */}
              <Divider sx={{ my: 1 }} />
              <Stack spacing={1}>
                {group.reviews.map(review => {
                  const isProcessing = processing === review.id;
                  const analysis = (review.ai_analysis || {}) as {
                    summary?: string;
                    note?: string;
                  };

                  return (
                    <Box
                      key={review.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1,
                        p: 1,
                        borderRadius: 1,
                        bgcolor: 'background.default',
                        opacity: isProcessing ? 0.5 : 1,
                        flexWrap: 'wrap',
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          flexWrap: 'wrap',
                        }}
                      >
                        {review.suggested_symbol && (
                          <Chip
                            label={review.suggested_symbol}
                            size="small"
                            color="primary"
                            sx={{ fontWeight: 'bold' }}
                          />
                        )}
                        {review.suggested_signal && (
                          <Chip
                            icon={
                              review.suggested_signal === 'BUY' ? (
                                <TrendingUp fontSize="small" />
                              ) : review.suggested_signal === 'SELL' ? (
                                <TrendingDown fontSize="small" />
                              ) : review.suggested_signal === 'HEDGE' ? (
                                <Shield fontSize="small" />
                              ) : review.suggested_signal === 'WATCH' ? (
                                <Visibility fontSize="small" />
                              ) : review.suggested_signal === 'CLOSED' ? (
                                <CheckCircle fontSize="small" />
                              ) : (
                                <TrendingFlat fontSize="small" />
                              )
                            }
                            label={getSignalLabel(review.suggested_signal)}
                            size="small"
                            color={
                              review.suggested_signal === 'BUY'
                                ? 'success'
                                : review.suggested_signal === 'SELL'
                                  ? 'error'
                                  : review.suggested_signal === 'HEDGE'
                                    ? 'warning'
                                    : review.suggested_signal === 'WATCH'
                                      ? 'info'
                                      : 'default'
                            }
                          />
                        )}
                        {review.confidence && (
                          <Chip
                            label={`${(review.confidence * 100).toFixed(0)}%`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                        {analysis.note && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ maxWidth: 200 }}
                            noWrap
                          >
                            {analysis.note}
                          </Typography>
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleReject(review)}
                          disabled={isProcessing}
                        >
                          <Close fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => handleApprove(review)}
                          disabled={isProcessing}
                        >
                          <Check fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>
                  );
                })}
              </Stack>
            </CardContent>

            {/* Group action: approve all assets from this post */}
            {isMultiAsset && (
              <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
                <Button
                  size="small"
                  variant="outlined"
                  color="success"
                  startIcon={<DoneAll />}
                  onClick={() => handleApproveGroup(group.reviews)}
                  disabled={batchProcessing}
                >
                  全部通過此貼文 ({group.reviews.length} 檔)
                </Button>
              </CardActions>
            )}
          </Card>
        );
      })}
    </Stack>
  );
}
