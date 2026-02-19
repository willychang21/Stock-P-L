/**
 * PendingReviewList - Displays AI-analyzed posts pending user review
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
  TextField,
  CircularProgress,
  Avatar,
  Tooltip,
  IconButton,
  Collapse,
  Slider,
  FormControl,
  FormLabel,
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
} from '@mui/icons-material';
import { useState, useEffect } from 'react';
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
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  const [processing, setProcessing] = useState<string | null>(null);
  const [postLimit, setPostLimit] = useState<number>(5);

  useEffect(() => {
    fetchPendingReviews();
  }, [isAutoTracking]); // Refresh when tracking completes

  const fetchPendingReviews = async () => {
    setLoading(true);
    try {
      const reviews = await apiClient.getPendingReviews();
      setPendingReviews(reviews);
    } catch (error) {
      console.error('Failed to fetch pending reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (review: PendingReview) => {
    setProcessing(review.id);
    try {
      const edits = editValues[review.id] || {};
      await apiClient.approvePendingReview(review.id, {
        symbol: edits.symbol || review.suggested_symbol,
        signal: edits.signal || review.suggested_signal,
        timeframe: edits.timeframe || review.suggested_timeframe,
        entry_price: edits.entry_price || null,
        target_price: edits.target_price || null,
        stop_loss: edits.stop_loss || null,
        note: edits.note || null,
      });
      // Remove from list
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

  const updateEditValue = (reviewId: string, field: string, value: any) => {
    setEditValues(prev => ({
      ...prev,
      [reviewId]: {
        ...(prev[reviewId] || {}),
        [field]: value,
      },
    }));
  };

  const getInfluencerInfo = (id: string) => {
    return influencers.find(i => i.id === id);
  };

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
                  <AutoMode />
                )
              }
            >
              {isAutoTracking ? '正在分析中...' : '開始追蹤分析'}
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
      {pendingReviews.map(review => {
        const influencer = getInfluencerInfo(review.influencer_id);
        const isExpanded = expandedId === review.id;
        const edits = editValues[review.id] || {};
        const isProcessing = processing === review.id;
        const analysis = (review.ai_analysis || {}) as { summary?: string };

        return (
          <Card
            key={review.id}
            variant="outlined"
            sx={{ opacity: isProcessing ? 0.6 : 1 }}
          >
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
                    {review.influencer_name}
                  </Typography>
                  <Chip
                    size="small"
                    label={review.source?.replace('AUTO_', '')}
                    color="secondary"
                    variant="outlined"
                  />
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {new Date(review.created_at).toLocaleDateString()}
                </Typography>
              </Box>

              {/* AI Analysis Summary */}
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                {review.suggested_signal && (
                  <Chip
                    icon={
                      review.suggested_signal === 'BUY' ? (
                        <TrendingUp fontSize="small" />
                      ) : (
                        <TrendingDown fontSize="small" />
                      )
                    }
                    label={getSignalLabel(review.suggested_signal)}
                    size="small"
                    color={
                      review.suggested_signal === 'BUY'
                        ? 'success'
                        : review.suggested_signal === 'SELL'
                          ? 'error'
                          : 'default'
                    }
                  />
                )}
                {review.suggested_symbol && (
                  <Chip
                    label={review.suggested_symbol}
                    size="small"
                    color="primary"
                  />
                )}
                {review.confidence && (
                  <Chip
                    label={`信心: ${(review.confidence * 100).toFixed(0)}%`}
                    size="small"
                    variant="outlined"
                  />
                )}
              </Box>

              {/* AI Summary */}
              {analysis.summary && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 1 }}
                >
                  📊 {analysis.summary}
                </Typography>
              )}

              {/* Original Content Preview */}
              <Typography
                variant="body2"
                sx={{
                  p: 1,
                  bgcolor: 'action.hover',
                  borderRadius: 1,
                  fontSize: '0.8rem',
                  maxHeight: isExpanded ? 'none' : 60,
                  overflow: 'hidden',
                }}
              >
                {review.original_content}
              </Typography>

              <Button
                size="small"
                onClick={() => setExpandedId(isExpanded ? null : review.id)}
                endIcon={isExpanded ? <ExpandLess /> : <ExpandMore />}
                sx={{ mt: 0.5 }}
              >
                {isExpanded ? '收起' : '展開'}
              </Button>

              {/* Expanded Edit Form */}
              <Collapse in={isExpanded}>
                <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <TextField
                    size="small"
                    label="標的代號"
                    value={edits.symbol ?? review.suggested_symbol ?? ''}
                    onChange={e =>
                      updateEditValue(review.id, 'symbol', e.target.value)
                    }
                    sx={{ width: 120 }}
                  />
                  <TextField
                    size="small"
                    label="進場價"
                    type="number"
                    value={edits.entry_price ?? ''}
                    onChange={e =>
                      updateEditValue(
                        review.id,
                        'entry_price',
                        parseFloat(e.target.value) || null
                      )
                    }
                    sx={{ width: 100 }}
                  />
                  <TextField
                    size="small"
                    label="目標價"
                    type="number"
                    value={edits.target_price ?? ''}
                    onChange={e =>
                      updateEditValue(
                        review.id,
                        'target_price',
                        parseFloat(e.target.value) || null
                      )
                    }
                    sx={{ width: 100 }}
                  />
                  <TextField
                    size="small"
                    label="止損價"
                    type="number"
                    value={edits.stop_loss ?? ''}
                    onChange={e =>
                      updateEditValue(
                        review.id,
                        'stop_loss',
                        parseFloat(e.target.value) || null
                      )
                    }
                    sx={{ width: 100 }}
                  />
                </Box>
              </Collapse>
            </CardContent>

            <CardActions sx={{ justifyContent: 'space-between', pt: 0 }}>
              <Box>
                {review.source_url && (
                  <Tooltip title="查看原文">
                    <IconButton
                      size="small"
                      href={review.source_url}
                      target="_blank"
                    >
                      <OpenInNew fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  color="error"
                  startIcon={<Close />}
                  onClick={() => handleReject(review)}
                  disabled={isProcessing}
                >
                  忽略
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  color="success"
                  startIcon={<Check />}
                  onClick={() => handleApprove(review)}
                  disabled={isProcessing}
                >
                  確認
                </Button>
              </Box>
            </CardActions>
          </Card>
        );
      })}
    </Stack>
  );
}
